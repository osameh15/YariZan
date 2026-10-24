// Operator-run Production Admin enrollment. Interactive terminal only: usernames, passwords,
// phone numbers and SMS codes are read without echo and are never written to a file, an argument,
// the environment or a log. The Backend gates still apply (this refuses to start in production
// while a gate is closed). Run with the same private environment as the API.
//   node tools/admin-enroll.mjs provision   create the two pending owner Admins
//   node tools/admin-enroll.mjs verify      verify one pending Admin by its own SMS code and activate it
//   node tools/admin-enroll.mjs report      sanitized readiness report
import "reflect-metadata";
import { randomUUID } from "node:crypto";
import readline from "node:readline";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../dist/src/app.js";
import { AdminEnrollment } from "../dist/src/admin/enrollment.js";

const command = process.argv[2];
if (!["provision", "verify", "report"].includes(command ?? "")) {
  console.error("usage: admin-enroll.mjs provision|verify|report");
  process.exit(2);
}
if (command !== "report" && !(process.stdin.isTTY && process.stdout.isTTY)) {
  console.error(
    "An interactive terminal is required; nothing was read or written.",
  );
  process.exit(2);
}
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
});
let muted = false;
const original = rl._writeToOutput;
rl._writeToOutput = (text) => original.call(rl, muted ? "" : text);
// Readline owns the terminal in raw mode: without this, Ctrl+C only pauses input and the tool hangs.
rl.on("SIGINT", () => {
  process.stdout.write("\nCancelled; nothing more was written.\n");
  process.exit(130);
});
const ask = (question, hidden) =>
  new Promise((resolve) => {
    // Readline writes the prompt itself (a prompt written beforehand is cleared by its line refresh);
    // the answer is muted only after the prompt is on screen.
    rl.question(question, (answer) => {
      muted = false;
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
    muted = hidden;
  });
const actor = () => ({ type: "SYSTEM", correlationId: randomUUID() });
const app = await NestFactory.createApplicationContext(AppModule, {
  logger: false,
});
const enrollment = app.get(AdminEnrollment);
const fail = (error) => {
  console.error(
    "Failed: " +
      (error?.code ?? error?.response?.code ?? error?.message ?? "ERROR"),
  );
  process.exitCode = 1;
};
try {
  if (command === "provision") {
    for (const n of [1, 2]) {
      console.log(`Owner Admin ${n} of 2`);
      const username = (await ask("  Username: ", false)).trim();
      const password = await ask("  Password (hidden): ", true);
      const again = await ask("  Repeat password (hidden): ", true);
      if (password !== again)
        throw Object.assign(new Error("MISMATCH"), {
          code: "PASSWORD_MISMATCH",
        });
      const mobile = await ask("  Verified mobile (hidden): ", true);
      const result = await enrollment.provision(
        { username, password, mobile },
        actor(),
      );
      console.log(
        `  ${username}: ${result.created ? "created" : "already exists"} (${result.state})`,
      );
    }
  } else if (command === "verify") {
    const username = (await ask("Username: ", false)).trim();
    const password = await ask("Password (hidden): ", true);
    const challenge = await enrollment.begin(username, password, actor());
    console.log(
      `A code was sent to the enrolled phone. It is valid for ${challenge.expires_in} seconds.`,
    );
    const code = await ask("Code (hidden): ", true);
    const done = await enrollment.complete(
      challenge.challenge_id,
      code.trim(),
      actor(),
    );
    console.log(
      `${username}: ${done.state}, role ${done.role}. No session was created.`,
    );
  }
  console.log(JSON.stringify(await enrollment.report(), null, 2));
} catch (error) {
  fail(error);
} finally {
  rl.close();
  await app.close();
}
