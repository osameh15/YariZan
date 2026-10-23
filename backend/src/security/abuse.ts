import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { Request } from "express";
import { Database } from "../database/database";
import { Security } from "./security";
import { equal, keyed } from "./crypto";
import { ApiError, requireCondition } from "../common/errors";

// G5 Option B (docs/YARIZAN-G5-ANTI-ABUSE.md): no client network address is trusted, because
// behind CDN -> Traefik -> Nuxt -> API the socket address is a container. Abuse is bounded by
// named global budgets (shared on purpose, isolated per purpose), failure-only counters per target,
// device-trust tokens that keep known browsers out of targeted floods, and proof of work in front of
// cost-bearing SMS. Every counter key is HMAC-namespaced by Security.rate.

/** Named global budgets: [limit, window seconds]. Shared by every client, isolated per name. */
export const budgets = {
  "customer-login": [600, 300],
  "admin-login": [120, 300],
  "otp-verify": [900, 300],
  "admin-otp-verify": [120, 300],
  "otp-admission": [600, 3600],
  claim: [600, 300],
  "pairing-preview": [600, 300],
  "pairing-pickup": [1200, 300],
  "payment-return": [600, 60],
} as const;
export type Budget = keyof typeof budgets;

/** Failed sign-ins tolerated per window before a target or a trusted browser is slowed. */
export const failureLimits = {
  customer: { untrusted: 10, trusted: 10, seconds: 900 },
  admin: { untrusted: 5, trusted: 10, seconds: 900 },
} as const;
export type Principal = keyof typeof failureLimits;

export const TRUST_COOKIE = {
  customer: "yz_trust",
  admin: "yz_trust_admin",
} as const;
export const trustPattern = /^[A-Za-z0-9_-]{20,200}\.[0-9a-f]{64}$/;
const TRUST_DAYS = 180;

export const powPurposes = ["LOGIN", "RESET", "CLAIM"] as const;
export type PowPurpose = (typeof powPurposes)[number];
const POW_SECONDS = 120;

export function leadingZeroBits(digest: Buffer) {
  let bits = 0;
  for (const byte of digest) {
    if (byte === 0) {
      bits += 8;
      continue;
    }
    bits += Math.clz32(byte) - 24;
    break;
  }
  return bits;
}
/** Reference solver, used by tests and tools; browsers solve the same puzzle in a Worker. */
export function solvePow(challenge: string, bits: number) {
  for (let counter = 0; ; counter++) {
    const digest = createHash("sha256")
      .update(challenge + ":" + counter)
      .digest();
    if (leadingZeroBits(digest) >= bits) return String(counter);
  }
}

@Injectable()
export class Abuse implements OnApplicationBootstrap, OnApplicationShutdown {
  private cleanup?: NodeJS.Timeout;
  constructor(
    private readonly security: Security,
    private readonly db: Database,
  ) {}

  /** Production difficulty is friction, never the only control (see the design document). */
  get powBits() {
    return this.security.config.NODE_ENV === "production" ? 18 : 4;
  }

  async budget(name: Budget) {
    const [limit, seconds] = budgets[name];
    await this.security.rate("budget:" + name, limit, seconds);
  }

  // Failure-only counters: a correct credential is never counted, and a known browser has its own.
  private failureKey(kind: Principal, target: string, trust: string | null) {
    return trust
      ? `login-fail:${kind}:trusted:${trust}`
      : `login-fail:${kind}:untrusted:${target}`;
  }
  async assertNotThrottled(
    kind: Principal,
    target: string,
    trust: string | null,
  ) {
    const l = failureLimits[kind];
    const count = await this.security.peek(
      this.failureKey(kind, target, trust),
      l.seconds,
    );
    requireCondition(
      count < (trust ? l.trusted : l.untrusted),
      "RATE_LIMITED",
      429,
    );
  }
  async recordFailure(kind: Principal, target: string, trust: string | null) {
    await this.security.bump(
      this.failureKey(kind, target, trust),
      failureLimits[kind].seconds,
    );
  }

  // Device trust: issued only after a verified sign-in (password, or password + SMS for Admin),
  // bound to the principal and to its credential stamp, so a password change revokes it.
  trustToken(kind: Principal, principalId: string, stamp: string) {
    const payload = Buffer.from(
      JSON.stringify({
        k: kind,
        p: principalId,
        s: stamp.slice(0, 16),
        e: Math.floor(Date.now() / 1000) + TRUST_DAYS * 86400,
        n: randomBytes(9).toString("base64url"),
      }),
    ).toString("base64url");
    return payload + "." + this.mac("YariZan-Trust-V1", payload);
  }
  /** Returns a stable id of a valid trust token for this principal, or null. */
  trusted(
    req: Request,
    kind: Principal,
    principalId: string | undefined,
    stamp: string,
  ) {
    const raw = (req.cookies as Record<string, string> | undefined)?.[
      TRUST_COOKIE[kind]
    ];
    if (!principalId || !raw || !trustPattern.test(raw)) return null;
    const [payload, mac] = raw.split(".");
    if (!equal(mac!, this.mac("YariZan-Trust-V1", payload!))) return null;
    try {
      const t = JSON.parse(Buffer.from(payload!, "base64url").toString()) as {
        k: string;
        p: string;
        s: string;
        e: number;
      };
      if (
        t.k !== kind ||
        t.p !== principalId ||
        t.s !== stamp.slice(0, 16) ||
        t.e <= Date.now() / 1000
      )
        return null;
      return mac!.slice(0, 32);
    } catch {
      return null;
    }
  }

  // Proof of work: a stateless HMAC challenge bound to purpose, target and expiry; consumed once.
  private issued = { window: 0, count: 0 };
  challenge(purpose: PowPurpose, target: string) {
    // Issuance is cheap (one HMAC, no database). A per-process ceiling keeps it bounded.
    const second = Math.floor(Date.now() / 1000);
    if (this.issued.window !== second)
      this.issued = { window: second, count: 0 };
    if (++this.issued.count > 60) throw new ApiError("RATE_LIMITED", 429);
    const bits = this.powBits;
    const payload = [
      "v1",
      purpose,
      target,
      second + POW_SECONDS,
      bits,
      randomBytes(12).toString("base64url"),
    ].join(".");
    return {
      challenge: payload + "." + this.mac("YariZan-PoW-V1", payload),
      bits,
      expires_in: POW_SECONDS,
    };
  }
  async verifyPow(
    purpose: PowPurpose,
    target: string,
    proof: { challenge: string; counter: string } | undefined,
  ) {
    requireCondition(proof, "CHALLENGE_REQUIRED", 400);
    const parts = proof.challenge.split(".");
    requireCondition(parts.length === 7, "CHALLENGE_INVALID", 400);
    const payload = parts.slice(0, 6).join("."),
      [version, p, t, exp, bits] = parts;
    requireCondition(
      version === "v1" &&
        equal(parts[6]!, this.mac("YariZan-PoW-V1", payload)) &&
        p === purpose &&
        equal(t!, target) &&
        Number(exp) > Date.now() / 1000 &&
        Number(bits) === this.powBits &&
        /^[0-9]{1,15}$/.test(proof.counter),
      "CHALLENGE_INVALID",
      400,
    );
    const digest = createHash("sha256")
      .update(proof.challenge + ":" + proof.counter)
      .digest();
    requireCondition(
      leadingZeroBits(digest) >= Number(bits),
      "CHALLENGE_INVALID",
      400,
    );
    // Atomic single use: the first consumer wins, a replay is refused.
    requireCondition(
      await this.security.once("pow:" + parts[6], Number(exp)),
      "CHALLENGE_INVALID",
      400,
    );
  }

  private mac(domain: string, value: string) {
    return keyed(this.security.config.TOKEN_HMAC_KEY, domain, value);
  }

  // Expired counters are removed, so rate state cannot grow without bound.
  onApplicationBootstrap() {
    if (this.security.config.NODE_ENV === "test") return;
    this.cleanup = setInterval(() => void this.purge().catch(() => {}), 600000);
    this.cleanup.unref();
  }
  onApplicationShutdown() {
    clearInterval(this.cleanup);
  }
  async purge(now = Date.now()) {
    const r = await this.db.query(
      "DELETE FROM rate_buckets WHERE bucket < $1",
      [Math.floor(now / 1000)],
    );
    return r.rowCount ?? 0;
  }
}
