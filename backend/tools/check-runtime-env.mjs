import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const image = process.argv[2] ?? "yarizan-backend-fixture";
const network = process.env.RUNTIME_DOCKER_NETWORK ?? "host";
const database = process.env.RUNTIME_DATABASE_URL ?? process.env.DATABASE_URL;
assert.ok(database, "An explicitly disposable database URL is required");
const docker = (...args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    timeout: 60000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const imageEnvironment = JSON.parse(docker("image", "inspect", image))[0].Config
  .Env;
assert.ok(
  !imageEnvironment.some((value) => value.startsWith("NODE_ENV=")),
  "Image must not select runtime mode",
);
console.log(
  docker(
    "run",
    "--rm",
    "--entrypoint",
    "node",
    image,
    "-e",
    "const f=require('fs');if(f.readdirSync('/app/.local').length)throw Error('Embedded key');require('argon2');if(process.getuid()!==1000)throw Error('Root runtime');console.log('Image: no embedded key, native Argon2 loads, uid 1000')",
  ),
);
const environment = ["--env", `DATABASE_URL=${database}`];
for (const key of ["CODE_HMAC_KEY", "TOKEN_HMAC_KEY", "MFA_ENCRYPTION_KEY"]) {
  assert.ok(process.env[key], `${key} must contain synthetic test material`);
  environment.push("--env", key);
}
const containers = new Set();
try {
  for (const [mode, expected] of [
    [undefined, "NODE_ENV_REQUIRED"],
    ["", "NODE_ENV_REQUIRED"],
    ["staging", "NODE_ENV_INVALID"],
    ["production", "PRODUCTION_GATE_CLOSED"],
  ]) {
    const name = "yarizan-runtime-" + randomUUID();
    containers.add(name);
    docker(
      "run",
      "-d",
      "--name",
      name,
      "--network",
      network,
      ...environment,
      ...(mode === undefined ? [] : ["--env", `NODE_ENV=${mode}`]),
      image,
    );
    assert.equal(docker("wait", name), "1");
    const logs = docker("logs", name);
    const state = JSON.parse(docker("inspect", name))[0].State;
    assert.equal(state.ExitCode, 1);
    const output = spawnSync("docker", ["logs", name], { encoding: "utf8" });
    assert.ok(
      (logs + output.stderr).includes(expected),
      `Missing safe refusal reason ${expected}`,
    );
    console.log(
      `Docker ${mode === undefined ? "missing" : mode === "" ? "empty" : mode}: refused (${expected})`,
    );
    docker("rm", name);
    containers.delete(name);
  }
  for (const mode of ["development", "test"]) {
    const name = "yarizan-runtime-" + randomUUID();
    containers.add(name);
    docker(
      "run",
      "-d",
      "--name",
      name,
      "--network",
      network,
      ...environment,
      "--env",
      `NODE_ENV=${mode}`,
      image,
    );
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        docker(
          "exec",
          name,
          "node",
          "-e",
          "fetch('http://127.0.0.1:3100/ready').then(async r=>{if(!r.ok)throw Error('Not ready');console.log(await r.text())}).catch(()=>process.exit(1))",
        );
        ready = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    assert.ok(ready, `Docker ${mode} readiness failed`);
    docker(
      "exec",
      name,
      "node",
      "-e",
      `const fs=require('fs');if(fs.existsSync('/app/.local/development-signing.pem')!==${mode === "development"})throw Error('Wrong key persistence mode')`,
    );
    docker("stop", "--time", "10", name);
    assert.equal(
      JSON.parse(docker("inspect", name))[0].State.ExitCode,
      0,
      "Graceful shutdown",
    );
    docker("rm", name);
    containers.delete(name);
    console.log(
      `Docker ${mode}: migrations, seed, readiness, signing mode and graceful shutdown passed`,
    );
  }
} finally {
  for (const name of containers) {
    try {
      docker("rm", "-f", name);
    } catch {
      /* Only containers created by this check. */
    }
  }
}
