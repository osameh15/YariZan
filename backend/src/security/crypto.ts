import {
  createHash,
  createHmac,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} from "node:crypto";
import { requireCondition } from "../common/errors";

export const hash = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex").toUpperCase();
export const token = () => randomBytes(32).toString("base64url");
export const keyed = (key: string, domain: string, value: string) =>
  createHmac("sha256", Buffer.from(key, "hex"))
    .update(domain + "\n" + value)
    .digest("hex");
export function equal(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function seal(value: string, key: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  const data = Buffer.concat([c.update(value, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), data]).toString("base64url");
}
export function unseal(value: string, key: string) {
  const b = Buffer.from(value, "base64url");
  const c = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(key, "hex"),
    b.subarray(0, 12),
  );
  c.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([c.update(b.subarray(28)), c.final()]).toString("utf8");
}
export function totp(secretHex: string, step: number) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", Buffer.from(secretHex, "hex"))
    .update(b)
    .digest();
  const o = h[19] & 15;
  return ((h.readUInt32BE(o) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
export const codeAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export function activationCode() {
  const chars = [...randomBytes(32)].map((b) => codeAlphabet[b & 31]).join("");
  return "YZ2-" + chars.match(/.{4}/g)!.join("-");
}
export function normalizeCode(value: string) {
  requireCondition(
    value.length <= 64 && /^[\x20-\x7e]+$/.test(value),
    "ACTIVATION_CODE_INVALID",
  );
  const s = value.replace(/[ -]/g, "").toUpperCase();
  requireCondition(
    /^YZ2[0-9ABCDEFGHJKMNPQRSTVWXYZ]{32}$/.test(s),
    "ACTIVATION_CODE_INVALID",
  );
  return "YZ2-" + s.slice(3).match(/.{4}/g)!.join("-");
}
