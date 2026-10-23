import { readFile } from "node:fs/promises";
import { configuration } from "../dist/src/config.js";
import { unseal } from "../dist/src/security/crypto.js";
import { generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { canonical } from "../dist/src/signing/signing.js";
import { solvePow } from "../dist/src/security/abuse.js";
if (process.env.NODE_ENV !== "development")
  throw new Error("Development-only synthetic pairing harness");
const base = new URL(process.env.HARNESS_BASE ?? "http://127.0.0.1:3100");
if (
  !["127.0.0.1", "localhost"].includes(base.hostname) ||
  base.protocol !== "http:"
)
  throw new Error("Local test API only");
const password = process.env.HARNESS_PASSWORD;
if (password && password.length < 12)
  throw new Error("HARNESS_PASSWORD must have at least 12 characters");
const cfg = configuration();
if (
  cfg.SMS_PROVIDER !== "fake" ||
  !cfg.SMS_FAKE_OUTBOX ||
  !cfg.MOBILE_ENCRYPTION_KEY
)
  throw new Error(
    "Synthetic harness requires explicit fake SMS and encrypted local delivery fixture",
  );
const call = async (route, body) => {
  const r = await fetch(new URL("/api/v2/" + route, base), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: process.env.HARNESS_ORIGIN ?? "http://localhost:3200",
    },
    body: JSON.stringify(body),
  });
  const result = await r.json();
  if (!r.ok) throw new Error(result.error.code);
  return result;
};
const pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" }),
  fingerprint_digest = randomBytes(32).toString("hex").toUpperCase(),
  device_public_key = pair.publicKey
    .export({ type: "spki", format: "der" })
    .toString("base64url");
const proof = async (purpose, pairing_id) => {
  const fields = {
    fingerprint_version: 2,
    fingerprint_digest,
    device_public_key,
  };
  const c = await call("devices/challenges", {
    ...fields,
    purpose,
    ...(pairing_id ? { pairing_id } : {}),
  });
  const transcript = {
    ...fields,
    challenge_id: c.challenge_id,
    nonce: c.nonce,
  };
  return {
    ...fields,
    challenge_id: c.challenge_id,
    challenge_signature: sign(
      "sha256",
      Buffer.from("YariZan-Device-Challenge-V2\n" + canonical(transcript)),
      { key: pair.privateKey, dsaEncoding: "ieee-p1363" },
    ).toString("base64url"),
  };
};
const p = await call("device-pairings", await proof("PAIR"));
const mobile = "09" + String(100000000 + Math.floor(Math.random() * 899999999));
// G5: the public OTP request carries a solved proof of work, as the browser does.
const issued = await call("auth/challenge", { purpose: "CLAIM", mobile });
const sent = await call("auth/claim/otp/request", {
  pairing_id: p.pairing_id,
  pairing_secret: p.pairing_secret,
  mobile,
  pow: {
    challenge: issued.challenge,
    counter: solvePow(issued.challenge, issued.bits),
  },
});
let code = "";
for (let n = 0; n < 200 && !code; n++) {
  try {
    const lines = (await readFile(cfg.SMS_FAKE_OUTBOX, "utf8"))
      .trim()
      .split("\n");
    for (const line of lines.reverse()) {
      try {
        const m = JSON.parse(unseal(line, cfg.MOBILE_ENCRYPTION_KEY));
        if (m.challengeId === sent.challenge_id) {
          code = m.code;
          break;
        }
      } catch {
        /* Concurrent fixture append. */
      }
    }
  } catch {
    /* Await synthetic delivery. */
  }
  if (!code) await new Promise((resolve) => setTimeout(resolve, 25));
}
if (!code) throw new Error("Synthetic SMS delivery unavailable");
await call("auth/claim", {
  pairing_id: p.pairing_id,
  pairing_secret: p.pairing_secret,
  ...(password ? { password } : {}),
  otp: { challenge_id: sent.challenge_id, code },
});
const e = await call(
  `device-pairings/${p.pairing_id}/pickup`,
  await proof("CONFIRM", p.pairing_id),
);
console.log(
  `Synthetic paired account created: ${e.username}. No credential or private key printed. Not physical ownership evidence.`,
);
