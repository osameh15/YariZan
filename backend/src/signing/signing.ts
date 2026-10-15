import { Injectable } from "@nestjs/common";
import {
  createPublicKey,
  createPrivateKey,
  generateKeyPairSync,
  KeyObject,
  sign,
  verify,
} from "node:crypto";
import { requireCondition } from "../common/errors";
import { configuration } from "../config";
import { hash } from "../security/crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { uuid, digest, sku } from "../common/schemas";
const binding = {
  device_id: uuid,
  device_fingerprint_version: z.literal(2),
  device_fingerprint_digest: digest,
};
export const artifactClaims = {
  enrollment: z.strictObject({
    ...binding,
    device_key_digest: digest,
    profile_enrollment_id: uuid,
  }),
  trial: z.strictObject({
    device_id: uuid,
    sku,
    grade: z.number().int().min(1).max(6),
    client_nonce: digest,
    process_session_id: uuid,
  }),
  license: z.strictObject({
    ...binding,
    license_id: uuid,
    customer_id: uuid,
    sku,
    grade: z.number().int().min(1).max(6),
    expires_at: z.null(),
    license_revision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  }),
  decision: z.strictObject({
    ...binding,
    license_id: uuid,
    sku,
    decision_version: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    status: z.enum(["ACTIVE", "REVOKED"]),
  }),
};

export function canonical(value: unknown, depth = 0): string {
  requireCondition(depth <= 8, "ARTIFACT_DEPTH");
  if (value === null || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number") {
    requireCondition(Number.isSafeInteger(value), "ARTIFACT_NUMBER");
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    requireCondition(
      !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(
        value,
      ),
      "ARTIFACT_UNICODE",
    );
    return JSON.stringify(value);
  }
  if (Array.isArray(value))
    return "[" + value.map((v) => canonical(v, depth + 1)).join(",") + "]";
  requireCondition(
    value &&
      typeof value === "object" &&
      Object.getPrototypeOf(value) === Object.prototype,
    "ARTIFACT_VALUE",
  );
  const v = value as Record<string, unknown>;
  return (
    "{" +
    Object.keys(v)
      .sort()
      .map((k) => canonical(k, depth + 1) + ":" + canonical(v[k], depth + 1))
      .join(",") +
    "}"
  );
}
export type Envelope = {
  algorithm: "ES256-P1363";
  payload: Record<string, unknown>;
  signature: string;
};
export interface SigningKeyManager {
  readonly kid: string;
  readonly publicKey: string;
  sign(message: Buffer): Buffer;
}
export const SIGNING_KEY_MANAGER = Symbol("SigningKeyManager");
export class DevelopmentKeyManager implements SigningKeyManager {
  readonly kid: string;
  readonly publicKey: string;
  private readonly privateKey: KeyObject;
  constructor() {
    const config = configuration();
    if (config.NODE_ENV === "test")
      this.privateKey = generateKeyPairSync("ec", {
        namedCurve: "prime256v1",
      }).privateKey;
    else {
      const dir = path.resolve(".local"),
        file = path.join(dir, "development-signing.pem");
      mkdirSync(dir, { recursive: true, mode: 0o700 });
      try {
        readFileSync(file);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        const key = generateKeyPairSync("ec", {
          namedCurve: "prime256v1",
        }).privateKey.export({ type: "pkcs8", format: "pem" });
        try {
          writeFileSync(file, key, { flag: "wx", mode: 0o600 });
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
        }
      }
      this.privateKey = createPrivateKey(readFileSync(file));
      requireCondition(
        this.privateKey.asymmetricKeyType === "ec" &&
          this.privateKey.asymmetricKeyDetails?.namedCurve === "prime256v1",
        "DEVELOPMENT_KEY_INVALID",
      );
    }
    this.publicKey = createPublicKey(this.privateKey)
      .export({ type: "spki", format: "pem" })
      .toString();
    this.kid =
      "disposable-development-" +
      hash(
        createPublicKey(this.privateKey).export({
          type: "spki",
          format: "der",
        }),
      ).slice(0, 16);
  }
  sign(message: Buffer) {
    return sign("sha256", message, {
      key: this.privateKey,
      dsaEncoding: "ieee-p1363",
    });
  }
}
export const profiles = {
  enrollment: {
    domain: "YariZan-Device-Enrollment-V2\n",
    format: "YARIZAN-DEVICE-ENROLLMENT-V2",
  },
  trial: {
    domain: "YariZan-Trial-Start-V2\n",
    format: "YARIZAN-TRIAL-START-V2",
  },
  license: { domain: "YariZan-License-V2\n", format: "YARIZAN-LICENSE-V2" },
  decision: {
    domain: "YariZan-License-Decision-V2\n",
    format: "YARIZAN-LICENSE-DECISION-V2",
  },
} as const;
import { Inject } from "@nestjs/common";
@Injectable()
export class Signing {
  constructor(@Inject(SIGNING_KEY_MANAGER) readonly keys: SigningKeyManager) {}
  artifact(
    type: keyof typeof profiles,
    claims: Record<string, unknown>,
  ): Envelope {
    const profile = profiles[type];
    artifactClaims[type].parse(claims);
    if ("grade" in claims)
      requireCondition(
        claims.sku === `YARIZAN-G${claims.grade}`,
        "ARTIFACT_PRODUCT",
      );
    const payload = {
      ...claims,
      format: profile.format,
      kid: this.keys.kid,
      issued_at: new Date().toISOString(),
    };
    const bytes = Buffer.from(profile.domain + canonical(payload));
    requireCondition(bytes.length < 32768, "ARTIFACT_SIZE");
    return {
      algorithm: "ES256-P1363",
      payload,
      signature: this.keys.sign(bytes).toString("base64url"),
    };
  }
}
export function devicePublicKey(encoded: string) {
  requireCondition(
    /^[A-Za-z0-9_-]{1,256}$/.test(encoded),
    "INVALID_DEVICE_KEY",
  );
  const der = Buffer.from(encoded, "base64url");
  requireCondition(der.toString("base64url") === encoded, "INVALID_DEVICE_KEY");
  let key: KeyObject;
  try {
    key = createPublicKey({ key: der, format: "der", type: "spki" });
  } catch {
    throw new Error("INVALID_DEVICE_KEY");
  }
  requireCondition(
    key.asymmetricKeyType === "ec" &&
      key.asymmetricKeyDetails?.namedCurve === "prime256v1",
    "INVALID_DEVICE_KEY",
  );
  requireCondition(
    key.export({ type: "spki", format: "der" }).equals(der),
    "INVALID_DEVICE_KEY",
  );
  return { key, digest: hash(der) };
}
export function verifyDeviceProof(
  publicKey: string,
  signature: string,
  claims: Record<string, unknown>,
) {
  const key = devicePublicKey(publicKey).key;
  requireCondition(/^[A-Za-z0-9_-]{86}$/.test(signature), "INVALID_PROOF", 401);
  const raw = Buffer.from(signature, "base64url");
  requireCondition(
    raw.length === 64 && raw.toString("base64url") === signature,
    "INVALID_PROOF",
    401,
  );
  requireCondition(
    verify(
      "sha256",
      Buffer.from("YariZan-Device-Challenge-V2\n" + canonical(claims)),
      { key, dsaEncoding: "ieee-p1363" },
      raw,
    ),
    "INVALID_PROOF",
    401,
  );
}
