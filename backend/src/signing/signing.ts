import { Injectable } from "@nestjs/common";
import {
  createHash,
  createPublicKey,
  createPrivateKey,
  generateKeyPairSync,
  KeyObject,
  sign,
  verify,
} from "node:crypto";
import { ApiError, requireCondition } from "../common/errors";
import { requireCapability } from "../security/capabilities";
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
/** The manager when no signing capability is enabled: it holds no key and refuses to sign. */
export class DisabledKeyManager implements SigningKeyManager {
  readonly kid = "disabled";
  readonly publicKey = "";
  sign(): Buffer {
    throw new ApiError("CAPABILITY_DISABLED", 503);
  }
}
/** Key ids that only ever name disposable keys; the Windows commercial check forbids the same words. */
export const NON_PRODUCTION_KID = /test|fixture|disposable|development|demo/i;
/** Production kid naming, e.g. "yarizan-license-2026-01". */
export const PRODUCTION_KID = /^yarizan-license-[a-z0-9-]{1,40}$/;
/** Uppercase hex SHA-256 of the SPKI DER, the same fingerprint as CommercialReleasePolicy (C#). */
export function publicKeyFingerprint(key: KeyObject) {
  return createHash("sha256")
    .update(createPublicKey(key).export({ type: "spki", format: "der" }))
    .digest("hex")
    .toUpperCase();
}
/**
 * Production license-signing key from a root-owned secret file (never an image layer, never the
 * environment). The file, the reviewed kid and the approved public fingerprint must all agree, so a
 * wrong or swapped file refuses startup instead of signing with an unapproved key.
 */
export class FileKeyManager implements SigningKeyManager {
  readonly kid: string;
  readonly publicKey: string;
  private readonly privateKey: KeyObject;
  constructor(file: string, kid: string, fingerprint: string) {
    requireCondition(
      PRODUCTION_KID.test(kid) && !NON_PRODUCTION_KID.test(kid),
      "SIGNING_KID_INVALID",
    );
    let key: KeyObject;
    try {
      key = createPrivateKey(readFileSync(file));
    } catch {
      throw new ApiError("SIGNING_KEY_UNREADABLE", 500);
    }
    requireCondition(
      key.asymmetricKeyType === "ec" &&
        key.asymmetricKeyDetails?.namedCurve === "prime256v1",
      "SIGNING_KEY_INVALID",
    );
    requireCondition(
      publicKeyFingerprint(key) === fingerprint,
      "SIGNING_KEY_NOT_APPROVED",
    );
    this.privateKey = key;
    this.kid = kid;
    this.publicKey = createPublicKey(key)
      .export({ type: "spki", format: "pem" })
      .toString();
  }
  sign(message: Buffer) {
    return sign("sha256", message, {
      key: this.privateKey,
      dsaEncoding: "ieee-p1363",
    });
  }
}
/**
 * Production must use the approved file key. Development and test use it when configured and the
 * disposable key otherwise.
 */
export function signingKeyManager(): SigningKeyManager {
  const c = configuration();
  // With neither licensing nor desktop provisioning enabled no artifact may be signed at all, so no
  // key is loaded or generated and every signing attempt is refused.
  if (
    !c.enabledCapabilities.has("TRIALS_AND_LICENSES") &&
    !c.enabledCapabilities.has("DESKTOP_PROVISIONING")
  )
    return new DisabledKeyManager();
  if (c.LICENSE_SIGNING_KEY_FILE)
    return new FileKeyManager(
      c.LICENSE_SIGNING_KEY_FILE,
      c.LICENSE_SIGNING_KID!,
      c.LICENSE_SIGNING_KEY_SHA256!,
    );
  requireCondition(c.NODE_ENV !== "production", "SIGNING_KEY_REQUIRED");
  return new DevelopmentKeyManager();
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
  private readonly enabled = configuration().enabledCapabilities;
  constructor(@Inject(SIGNING_KEY_MANAGER) readonly keys: SigningKeyManager) {}
  artifact(
    type: keyof typeof profiles,
    claims: Record<string, unknown>,
  ): Envelope {
    requireCapability(
      this.enabled,
      type === "enrollment" ? "DESKTOP_PROVISIONING" : "TRIALS_AND_LICENSES",
    );
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
