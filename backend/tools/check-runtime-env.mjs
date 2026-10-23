import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

// Container acceptance for the API image, using disposable data only:
// image contents, non-root read-only runtime, fail-closed startup modes, separate one-off
// migration, readiness and graceful shutdown inside the infrastructure's 20 s grace period.
const image = process.argv[2] ?? "yarizan-backend-fixture";
const network = process.env.RUNTIME_DOCKER_NETWORK ?? "host";
const database = process.env.RUNTIME_DATABASE_URL ?? process.env.DATABASE_URL;
assert.ok(database, "An explicitly disposable database URL is required");
const docker = (...args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    timeout: 120000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
// Production-equivalent hardening, matching the infrastructure Compose file.
const hardening = [
  "--read-only",
  "--cap-drop",
  "ALL",
  "--security-opt",
  "no-new-privileges:true",
  "--user",
  "1000:1000",
  "--tmpfs",
  "/tmp:size=16m,uid=1000,gid=1000,mode=0700",
  "--memory",
  "512m",
  "--pids-limit",
  "128",
];
const inspect = JSON.parse(docker("image", "inspect", image))[0].Config;
assert.ok(
  !inspect.Env.some((value) => value.startsWith("NODE_ENV=")),
  "Image must not select runtime mode",
);
assert.deepEqual(inspect.Cmd, ["node", "dist/src/main.js"], "Runtime command");
assert.equal(inspect.User, "1000:1000", "Image user");
console.log("Image: CMD node dist/src/main.js, user 1000:1000, no NODE_ENV");
console.log(
  docker(
    "run",
    "--rm",
    ...hardening,
    "--entrypoint",
    "node",
    image,
    "-e",
    [
      "const f=require('fs');",
      "for(const p of ['/app/.local','/app/.env','/app/test','/app/tools','/app/src','/usr/local/bin/npm','/usr/local/bin/npx','/usr/local/bin/yarn','/usr/local/lib/node_modules/npm'])if(f.existsSync(p))throw Error('Unexpected '+p);",
      "for(const p of ['/app','/app/dist','/app/migrations'])try{f.accessSync(p,f.constants.W_OK);throw Error('Writable '+p)}catch(e){if(e.message.startsWith('Writable'))throw e}",
      "const walk=d=>f.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):[d+'/'+e.name]);",
      "const keys=walk('/app').filter(p=>/\\.(pem|key)$|\\.env$/.test(p));if(keys.length)throw Error('Key material '+keys);",
      "require('argon2');if(process.getuid()!==1000||process.getgid()!==1000)throw Error('Root runtime');",
      "f.writeFileSync('/tmp/probe','x');",
      "console.log('Image: no key/env/test/tools/package manager, read-only /app, tmpfs /tmp, native Argon2, uid 1000')",
    ].join(""),
  ),
);
const environment = ["--env", `DATABASE_URL=${database}`];
for (const key of ["CODE_HMAC_KEY", "TOKEN_HMAC_KEY", "MFA_ENCRYPTION_KEY"]) {
  assert.ok(process.env[key], `${key} must contain synthetic test material`);
  environment.push("--env", key);
}
const containers = new Set();
const run = (args, command = []) => {
  const name = "yarizan-runtime-" + randomUUID();
  containers.add(name);
  docker(
    "run",
    "-d",
    "--name",
    name,
    "--network",
    network,
    ...hardening,
    ...args,
    image,
    ...command,
  );
  return name;
};
const finished = (name, expected) => {
  assert.equal(docker("wait", name), String(expected.exit));
  const output = spawnSync("docker", ["logs", name], { encoding: "utf8" });
  assert.ok(
    (output.stdout + output.stderr).includes(expected.text),
    `Missing ${expected.text}`,
  );
  docker("rm", name);
  containers.delete(name);
};
try {
  // One-off migrations are separate from the API. Production needs the migration login.
  finished(
    run(
      ["--env", "NODE_ENV=production", "--env", `DATABASE_URL=${database}`],
      ["node", "dist/src/database/migrate.js"],
    ),
    { exit: 1, text: "MIGRATION_DATABASE_URL_REQUIRED" },
  );
  finished(
    run(
      [
        "--env",
        "NODE_ENV=production",
        "--env",
        `DATABASE_URL=${database}`,
        "--env",
        `MIGRATION_DATABASE_URL=${database}`,
      ],
      ["node", "dist/src/database/migrate.js"],
    ),
    { exit: 1, text: "INDEPENDENT_DATABASE_CREDENTIALS_REQUIRED" },
  );
  finished(
    run(
      ["--env", "NODE_ENV=production", ...environment],
      ["node", "dist/src/database/seed.js"],
    ),
    { exit: 1, text: "DEVELOPMENT_SEED_REFUSED" },
  );
  console.log(
    "Docker migrate/seed: production refuses shared login and development seed",
  );
  finished(
    run(
      ["--env", "NODE_ENV=test", ...environment],
      ["node", "dist/src/database/migrate.js"],
    ),
    { exit: 0, text: "migrations_applied" },
  );
  finished(
    run(
      ["--env", "NODE_ENV=test", ...environment],
      ["node", "dist/src/database/migrate.js", "--verify"],
    ),
    { exit: 0, text: '"total":9' },
  );
  finished(
    run(
      ["--env", "NODE_ENV=test", ...environment],
      ["node", "dist/src/database/seed.js"],
    ),
    { exit: 0, text: "Six products seeded" },
  );
  console.log(
    "Docker one-off migration (9), verification and test seed passed read-only",
  );
  for (const [mode, expected, extra] of [
    [undefined, "NODE_ENV_REQUIRED"],
    ["", "NODE_ENV_REQUIRED"],
    ["staging", "NODE_ENV_INVALID"],
    ["production", "ENABLED_CAPABILITIES_REQUIRED"],
    [
      "production",
      "CAPABILITY_GATE_CLOSED: TRIALS_AND_LICENSES: G1_SIGNING_CUSTODY",
      ["--env", "ENABLED_CAPABILITIES=PRODUCTION_CORE,TRIALS_AND_LICENSES"],
    ],
    [
      "test",
      "ZARINPAL_LIVE_PRODUCTION_ONLY",
      ["--env", "COMMERCE_MODE=zarinpal"],
    ],
  ]) {
    finished(
      run([
        ...environment,
        ...(extra ?? []),
        ...(mode === undefined ? [] : ["--env", `NODE_ENV=${mode}`]),
      ]),
      { exit: 1, text: expected },
    );
    console.log(
      `Docker ${mode === undefined ? "missing" : mode === "" ? "empty" : mode}: refused (${expected})`,
    );
  }
  for (const mode of ["development", "test"]) {
    // Development keeps disposable signing keys under /app/.local; give it a tmpfs there only.
    const name = run([
      ...environment,
      "--env",
      `NODE_ENV=${mode}`,
      ...(mode === "development"
        ? ["--tmpfs", "/app/.local:size=1m,uid=1000,gid=1000,mode=0700"]
        : []),
    ]);
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
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
    console.log(
      `Docker ${mode}: resource usage ${docker("stats", "--no-stream", "--format", "{{.MemUsage}} {{.CPUPerc}}", name)}`,
    );
    const started = Date.now();
    docker("stop", "--time", "20", name);
    const elapsed = Date.now() - started;
    assert.equal(
      JSON.parse(docker("inspect", name))[0].State.ExitCode,
      0,
      "Graceful shutdown",
    );
    assert.ok(elapsed < 20000, "Shutdown within the 20 s grace period");
    const stats = docker("logs", name);
    assert.ok(!/PRIVATE KEY|password|otp_code/i.test(stats), "Secrets in logs");
    docker("rm", name);
    containers.delete(name);
    console.log(
      `Docker ${mode}: read-only readiness, signing mode and graceful shutdown in ${elapsed} ms`,
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
