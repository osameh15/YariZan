import { generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { canonical } from "../dist/src/signing/signing.js";
if (process.env.NODE_ENV !== "development")
  throw new Error("Development-only synthetic pairing harness");
const base = new URL(process.env.HARNESS_BASE ?? "http://127.0.0.1:3100");
if (
  !["127.0.0.1", "localhost"].includes(base.hostname) ||
  base.protocol !== "http:"
)
  throw new Error("Local test API only");
const password = process.env.HARNESS_PASSWORD;
if (!password || password.length < 12)
  throw new Error("Set HARNESS_PASSWORD for synthetic test account");
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
await call("auth/claim", {
  pairing_id: p.pairing_id,
  pairing_secret: p.pairing_secret,
  password,
});
const e = await call(
  `device-pairings/${p.pairing_id}/pickup`,
  await proof("CONFIRM", p.pairing_id),
);
console.log(
  `Synthetic paired account created: ${e.username}. No credential or private key printed. Not physical ownership evidence.`,
);
