import { readFile } from "node:fs/promises";
import { configuration } from "../config";
import { unseal } from "../security/crypto";
import { Database } from "../database/database";
// Explicit operator-only inspection of synthetic local delivery. Never mounted as an API route.
export async function readFakeSms() {
  const cfg = configuration();
  if (
    cfg.SMS_PROVIDER !== "fake" ||
    !cfg.SMS_FAKE_OUTBOX ||
    !cfg.MOBILE_ENCRYPTION_KEY
  )
    throw Error("FAKE_LOCAL_SMS_ONLY");
  const db = new Database();
  try {
    const lines = (await readFile(cfg.SMS_FAKE_OUTBOX, "utf8"))
      .trim()
      .split("\n");
    for (const line of lines.reverse()) {
      if (!line) continue;
      const m = JSON.parse(unseal(line, cfg.MOBILE_ENCRYPTION_KEY)) as {
        challengeId: string;
        code: string;
        mobile: string;
        purpose: string;
      };
      const r = await db.query(
        "SELECT 1 FROM otp_challenges WHERE id=$1 AND delivered AND used_at IS NULL AND expires_at>now()",
        [m.challengeId],
      );
      if (r.rowCount) {
        process.stdout.write(
          `SYNTHETIC LOCAL SMS ONLY: ${m.purpose}, mobile ending ${m.mobile.slice(-4)}, code ${m.code}\n`,
        );
        return;
      }
    }
    process.stdout.write(
      "No unused, unexpired synthetic SMS. Request a fresh code in the local UI.\n",
    );
  } finally {
    await db.onApplicationShutdown();
  }
}
if (require.main === module)
  void readFakeSms().catch(() => {
    process.stderr.write(
      "Fake SMS inspection unavailable. Check explicit local fake-provider configuration.\n",
    );
    process.exitCode = 1;
  });
