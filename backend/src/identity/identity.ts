import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PoolClient } from "pg";
import { PasswordHashing } from "../security/passwords";
import { Database } from "../database/database";
import {
  Signing,
  devicePublicKey,
  verifyDeviceProof,
} from "../signing/signing";
import { Security, CustomerContext } from "../security/security";
import { Audit, Actor } from "../audit/audit";
import { requireCondition } from "../common/errors";
import { challengeSchema, Proof } from "../common/schemas";
import { equal, token } from "../security/crypto";
import { Otp, normalizeMobile } from "../accounts/otp";
import { customerSession } from "../accounts/sessions";
import { unseal } from "../security/crypto";
import { z } from "zod";

interface Pairing {
  id: string;
  device_id: string;
  generation: number;
  protocol: number;
  cancelled_at: Date | null;
  fingerprint_digest: string;
  public_key: string;
  key_digest: string;
  status: string;
  expires_at: Date;
  secret_hash: string;
  browser_hash: string | null;
  claim_hash: string | null;
  authorized_customer_id: string | null;
}
@Injectable()
export class Identity {
  constructor(
    private db: Database,
    private signing: Signing,
    private security: Security,
    private audit: Audit,
    private passwords: PasswordHashing,
    private otp: Otp,
  ) {}
  async challenge(input: z.infer<typeof challengeSchema>) {
    const key = devicePublicKey(input.device_public_key);
    requireCondition(
      (input.purpose === "CONFIRM") === !!input.pairing_id,
      "INVALID_REQUEST",
    );
    // A pairing id this server never issued (for example one left on the device by another backend)
    // is an invalid pairing, which the desktop client clears before starting a new one. Without this
    // check the foreign key below fails and the request ends as a generic 503.
    if (input.pairing_id)
      requireCondition(
        (
          await this.db.query("SELECT 1 FROM pairings WHERE id=$1", [
            input.pairing_id,
          ])
        ).rowCount,
        "PAIRING_INVALID",
        410,
      );
    const id = randomUUID(),
      nonce = token(),
      expires = new Date(Date.now() + 120000);
    await this.db.query(
      `INSERT INTO device_challenges(id,nonce,fingerprint_digest,public_key,key_digest,purpose,pairing_id,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        id,
        nonce,
        input.fingerprint_digest,
        input.device_public_key,
        key.digest,
        input.purpose,
        input.pairing_id ?? null,
        expires,
      ],
    );
    return { challenge_id: id, nonce, expires_at: expires.toISOString() };
  }
  private async proof(
    c: PoolClient,
    p: Proof,
    purpose: string,
    pairingId?: string,
  ) {
    const r = await c.query<{
      nonce: string;
      fingerprint_digest: string;
      public_key: string;
      key_digest: string;
      purpose: string;
      pairing_id: string | null;
      expires_at: Date;
      used_at: Date | null;
    }>("SELECT * FROM device_challenges WHERE id=$1 FOR UPDATE", [
      p.challenge_id,
    ]);
    const row = r.rows[0];
    requireCondition(
      row && !row.used_at && row.expires_at.getTime() > Date.now(),
      "CHALLENGE_INVALID",
      401,
    );
    requireCondition(
      row.purpose === purpose &&
        row.pairing_id === (pairingId ?? null) &&
        row.public_key === p.device_public_key &&
        row.fingerprint_digest === p.fingerprint_digest,
      "INVALID_PROOF",
      401,
    );
    verifyDeviceProof(p.device_public_key, p.challenge_signature, {
      challenge_id: p.challenge_id,
      nonce: row.nonce,
      fingerprint_version: p.fingerprint_version,
      fingerprint_digest: p.fingerprint_digest,
      device_public_key: p.device_public_key,
    });
    await c.query("UPDATE device_challenges SET used_at=now() WHERE id=$1", [
      p.challenge_id,
    ]);
    return row;
  }
  async pairing(p: Proof, actor: Actor) {
    return this.db.transaction(async (c) => {
      const row = await this.proof(c, p, "PAIR");
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        row.fingerprint_digest,
      ]);
      const username =
        "YZ-" + row.fingerprint_digest.slice(0, 24).match(/.{4}/g)!.join("-");
      await c.query(
        "INSERT INTO devices(id,fingerprint_version,fingerprint_digest,username) VALUES($1,2,$2,$3) ON CONFLICT(fingerprint_version,fingerprint_digest) DO NOTHING",
        [randomUUID(), row.fingerprint_digest, username],
      );
      const d = (
        await c.query<{ id: string; generation: number }>(
          "SELECT id,generation FROM devices WHERE fingerprint_digest=$1 FOR UPDATE",
          [row.fingerprint_digest],
        )
      ).rows[0];
      const id = randomUUID(),
        secret = token();
      await c.query(
        `INSERT INTO pairings(id,fingerprint_digest,public_key,key_digest,secret_hash,status,expires_at,device_id,generation,protocol)
        VALUES($1,$2,$3,$4,$5,'PENDING',now()+interval '5 minutes',$6,$7,3)`,
        [
          id,
          row.fingerprint_digest,
          row.public_key,
          row.key_digest,
          this.security.tokenHash(secret),
          d.id,
          d.generation,
        ],
      );
      await this.audit.append(c, actor, "pairing.created", id);
      return {
        pairing_id: id,
        pairing_secret: secret,
        username,
        expires_at: new Date(Date.now() + 300000).toISOString(),
      };
    });
  }
  private validateBrowser(
    p: Pairing | undefined,
    secret: string,
  ): asserts p is Pairing {
    requireCondition(
      p &&
        p.protocol === 3 &&
        p.status === "PENDING" &&
        !p.cancelled_at &&
        p.expires_at.getTime() > Date.now() &&
        equal(p.secret_hash, this.security.tokenHash(secret)),
      "PAIRING_INVALID",
      410,
    );
  }
  async preview(id: string, secret: string) {
    const p = (
      await this.db.query<Pairing>("SELECT * FROM pairings WHERE id=$1", [id])
    ).rows[0];
    this.validateBrowser(p, secret);
    const d = (
      await this.db.query<{
        username: string;
        generation: number;
        customer_id: string | null;
      }>(
        `SELECT d.username,d.generation,c.id customer_id FROM devices d LEFT JOIN customers c ON c.device_id=d.id AND c.generation=d.generation AND c.state='ACTIVE' WHERE d.id=$1`,
        [p.device_id],
      )
    ).rows[0];
    requireCondition(
      d && d.generation === p.generation,
      "PAIRING_INVALID",
      410,
    );
    return {
      username: d.username,
      requires_owner: !!d.customer_id,
      status: "PENDING",
      expires_at: p.expires_at.toISOString(),
    };
  }
  async requestClaimOtp(
    id: string,
    secret: string,
    mobile: string,
    actor: Actor,
  ) {
    const p = (
      await this.db.query<Pairing>("SELECT * FROM pairings WHERE id=$1", [id])
    ).rows[0];
    this.validateBrowser(p, secret);
    const d = (
      await this.db.query<{ generation: number }>(
        "SELECT generation FROM devices WHERE id=$1",
        [p.device_id],
      )
    ).rows[0];
    requireCondition(d?.generation === p.generation, "PAIRING_INVALID", 410);
    requireCondition(
      !(
        await this.db.query(
          "SELECT 1 FROM customers WHERE device_id=$1 AND generation=$2 AND state='ACTIVE'",
          [p.device_id, p.generation],
        )
      ).rowCount,
      "PROFILE_NOT_AUTHORIZED",
      403,
    );
    await this.security.rate("sms-pair:" + id, 3, 3600);
    return this.otp.issue("CLAIM", normalizeMobile(mobile), actor, {
      pairing_id: id,
      generation: p.generation,
    });
  }
  async claim(
    id: string,
    secret: string,
    password: string | undefined,
    authorizer: CustomerContext | undefined,
    actor: Actor,
    otpProof?: { challenge_id: string; code: string },
  ) {
    const customerId = authorizer?.id;
    const snapshot = (
      await this.db.query<Pairing>("SELECT * FROM pairings WHERE id=$1", [id])
    ).rows[0];
    this.validateBrowser(snapshot, secret);
    const owner = (
      await this.db.query<{ id: string }>(
        "SELECT id FROM customers WHERE device_id=$1 AND generation=$2 AND state='ACTIVE'",
        [snapshot.device_id, snapshot.generation],
      )
    ).rows[0];
    if (owner)
      requireCondition(customerId === owner.id, "PROFILE_NOT_AUTHORIZED", 403);
    else {
      requireCondition(!customerId && otpProof, "OTP_REQUIRED");
      const admitted = await this.otp.admit(
        otpProof.challenge_id,
        "CLAIM",
        otpProof.code,
      );
      requireCondition(
        admitted.pairing_id === id &&
          admitted.generation === snapshot.generation,
        "OTP_INVALID",
        401,
      );
    }
    const generation = (
      await this.db.query<{ generation: number }>(
        "SELECT generation FROM devices WHERE id=$1",
        [snapshot.device_id],
      )
    ).rows[0]?.generation;
    requireCondition(
      generation === snapshot.generation,
      "PAIRING_INVALID",
      410,
    );
    await this.security.rate("claim-authorized:" + id, 3, 300);
    const encoded =
      !owner && password ? await this.passwords.hash(password) : null;
    return this.db.transaction(async (c) => {
      const d = (
        await c.query<{ id: string; generation: number; username: string }>(
          "SELECT id,generation,username FROM devices WHERE id=$1 FOR UPDATE",
          [snapshot.device_id],
        )
      ).rows[0];
      const p = (
        await c.query<Pairing>(
          "SELECT * FROM pairings WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      this.validateBrowser(p, secret);
      requireCondition(d.generation === p.generation, "PAIRING_INVALID", 410);
      let session: Awaited<ReturnType<typeof customerSession>> | undefined;
      let customer = (
        await c.query<{ id: string }>(
          "SELECT id FROM customers WHERE device_id=$1 AND generation=$2 AND state='ACTIVE' FOR UPDATE",
          [d.id, d.generation],
        )
      ).rows[0];
      if (customer) {
        requireCondition(
          customerId === customer.id,
          "PROFILE_NOT_AUTHORIZED",
          403,
        );
        const session = await c.query(
          "SELECT 1 FROM customer_sessions WHERE token_hash=$1 AND customer_id=$2 AND revoked_at IS NULL AND expires_at>clock_timestamp() FOR SHARE",
          [authorizer?.token_hash, customer.id],
        );
        requireCondition(session.rowCount, "UNAUTHENTICATED", 401);
      } else {
        requireCondition(!customerId && otpProof, "OTP_REQUIRED");
        const verified = await this.otp.consume(
          c,
          otpProof.challenge_id,
          "CLAIM",
          otpProof.code,
          actor,
        );
        requireCondition(
          verified.pairing_id === id && verified.generation === d.generation,
          "OTP_INVALID",
          401,
        );
        const mobile = unseal(
          verified.mobile_ciphertext,
          this.security.config.MOBILE_ENCRYPTION_KEY!,
        );
        customer = { id: randomUUID() };
        await c.query(
          "INSERT INTO customers(id,device_id,generation,username,password_hash,state,mobile_ciphertext,mobile_lookup,mobile_last4,mobile_verified_at) VALUES($1,$2,$3,$4,$5,'ACTIVE',$6,$7,$8,now())",
          [
            customer.id,
            d.id,
            d.generation,
            d.username,
            encoded,
            verified.mobile_ciphertext,
            verified.mobile_lookup,
            mobile.slice(-4),
          ],
        );
      }
      // The initial browser session commits with the account, OTP and pairing transition.
      if (!owner && !customerId) {
        session = await customerSession(c, this.security, customer.id);
        await this.audit.append(
          c,
          { ...actor, type: "CUSTOMER", id: customer.id },
          "customer.login_claim",
          customer.id,
        );
      }
      const changed = await c.query(
        "UPDATE pairings SET status='BROWSER_CONFIRMED',authorized_customer_id=$2 WHERE id=$1 AND status='PENDING' AND expires_at>clock_timestamp() AND cancelled_at IS NULL RETURNING id",
        [id, customer.id],
      );
      requireCondition(changed.rowCount, "PAIRING_INVALID", 410);
      await this.audit.append(c, actor, "pairing.browser_approved", id, {
        generation: d.generation,
      });
      return {
        session,
        status: "APPROVED",
        username: d.username,
        expires_at: p.expires_at.toISOString(),
      };
    });
  }
  async cancel(id: string, secret: string, actor: Actor) {
    return this.db.transaction(async (c) => {
      const r = await c.query(
        "UPDATE pairings SET cancelled_at=now() WHERE id=$1 AND protocol=3 AND secret_hash=$2 AND status IN ('PENDING','BROWSER_CONFIRMED') AND cancelled_at IS NULL AND expires_at>now() RETURNING id",
        [id, this.security.tokenHash(secret)],
      );
      requireCondition(r.rowCount, "PAIRING_INVALID", 410);
      await this.audit.append(c, actor, "pairing.cancelled", id);
      return { status: "CANCELLED" };
    });
  }
  async pickup(id: string, p: Proof, actor: Actor) {
    return this.db.transaction(async (c) => {
      const proof = await this.proof(c, p, "CONFIRM", id);
      const snapshot = (
        await c.query<Pairing>("SELECT * FROM pairings WHERE id=$1", [id])
      ).rows[0];
      requireCondition(
        snapshot && snapshot.protocol === 3,
        "PAIRING_INVALID",
        410,
      );
      const d = (
        await c.query<{ id: string; generation: number; username: string }>(
          "SELECT id,generation,username FROM devices WHERE id=$1 FOR UPDATE",
          [snapshot.device_id],
        )
      ).rows[0];
      const pair = (
        await c.query<Pairing>(
          "SELECT * FROM pairings WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      requireCondition(
        pair &&
          !pair.cancelled_at &&
          pair.expires_at.getTime() > Date.now() &&
          pair.key_digest === proof.key_digest &&
          pair.fingerprint_digest === proof.fingerprint_digest &&
          pair.generation === d.generation,
        "PAIRING_INVALID",
        410,
      );
      if (pair.status === "PENDING") return { status: "PENDING" };
      requireCondition(
        ["BROWSER_CONFIRMED", "CONSUMED"].includes(pair.status),
        "PAIRING_INVALID",
        410,
      );
      const customer = (
        await c.query<{ id: string }>(
          "SELECT id FROM customers WHERE id=$1 AND device_id=$2 AND generation=$3 AND state='ACTIVE' FOR UPDATE",
          [pair.authorized_customer_id, d.id, d.generation],
        )
      ).rows[0];
      requireCondition(customer, "PAIRING_INVALID", 410);
      const existing = (
        await c.query<{
          id: string;
          device_id: string;
          generation: number;
          status: string;
          signed_enrollment: object;
        }>("SELECT * FROM device_keys WHERE key_digest=$1 FOR UPDATE", [
          pair.key_digest,
        ])
      ).rows[0];
      requireCondition(
        !existing || existing.device_id === d.id,
        "KEY_ALREADY_ENROLLED",
        409,
      );
      const keyId = existing?.id ?? randomUUID();
      let enrollment = existing?.signed_enrollment;
      if (pair.status === "BROWSER_CONFIRMED") {
        requireCondition(
          !existing || existing.generation < d.generation,
          "KEY_ALREADY_ENROLLED",
          409,
        );
        enrollment = this.signing.artifact("enrollment", {
          device_id: d.id,
          device_fingerprint_version: 2,
          device_fingerprint_digest: pair.fingerprint_digest,
          device_key_digest: pair.key_digest,
          profile_enrollment_id: keyId,
        });
        await c.query(
          `INSERT INTO device_keys(id,device_id,generation,customer_id,public_key,key_digest,signed_enrollment) VALUES($1,$2,$3,$4,$5,$6,$7)
          ON CONFLICT(id) DO UPDATE SET generation=EXCLUDED.generation,customer_id=EXCLUDED.customer_id,status='ACTIVE',signed_enrollment=EXCLUDED.signed_enrollment`,
          [
            keyId,
            d.id,
            d.generation,
            customer.id,
            pair.public_key,
            pair.key_digest,
            enrollment,
          ],
        );
        await c.query(
          "INSERT INTO device_enrollment_history(id,key_id,customer_id,generation,signed_enrollment) VALUES($1,$2,$3,$4,$5)",
          [randomUUID(), keyId, customer.id, d.generation, enrollment],
        );
        await c.query("UPDATE pairings SET status='CONSUMED' WHERE id=$1", [
          id,
        ]);
        await this.audit.append(c, actor, "enrollment.approved", d.id, {
          profile_enrollment_id: keyId,
          generation: d.generation,
        });
      } else
        requireCondition(
          existing?.status === "ACTIVE" && existing.generation === d.generation,
          "PAIRING_INVALID",
          410,
        );
      await c.query(
        "UPDATE device_credentials SET revoked_at=now() WHERE key_id=$1 AND revoked_at IS NULL",
        [keyId],
      );
      return {
        status: "ENROLLED",
        device_id: d.id,
        customer_id: customer.id,
        username: d.username,
        enrollment,
        credential: await this.credential(c, keyId),
      };
    });
  }
  async authenticate(p: Proof, actor: Actor) {
    return this.db.transaction(async (c) => {
      const row = await this.proof(c, p, "AUTH");
      const k = (
        await c.query<{
          id: string;
          device_id: string;
          status: string;
          generation: number;
          current_generation: number;
          customer_state: string;
          signed_enrollment: object;
          fingerprint_digest: string;
        }>(
          `SELECT k.id,k.device_id,k.status,k.generation,d.generation current_generation,c.state customer_state,k.signed_enrollment,d.fingerprint_digest FROM device_keys k JOIN devices d ON d.id=k.device_id JOIN customers c ON c.id=k.customer_id WHERE key_digest=$1 FOR UPDATE OF d,k`,
          [row.key_digest],
        )
      ).rows[0];
      requireCondition(
        k &&
          k.status !== "REPLACED" &&
          k.fingerprint_digest === p.fingerprint_digest,
        "ENROLLMENT_REQUIRED",
        401,
      );
      await this.audit.append(c, actor, "device.authenticated", k.device_id);
      return {
        device_id: k.device_id,
        credential: await this.credential(c, k.id),
        scope:
          k.status === "ACTIVE" &&
          k.generation === k.current_generation &&
          k.customer_state === "ACTIVE"
            ? "desktop"
            : "tombstone_only",
        ...(k.status === "ACTIVE" &&
        k.generation === k.current_generation &&
        k.customer_state === "ACTIVE"
          ? { enrollment: k.signed_enrollment }
          : {}),
      };
    });
  }
  private async credential(c: PoolClient, keyId: string) {
    const value = token();
    await c.query(
      `INSERT INTO device_credentials(token_hash,key_id,expires_at,customer_id,device_id,generation) SELECT $1,id,now()+interval '15 minutes',customer_id,device_id,generation FROM device_keys WHERE id=$2`,
      [this.security.tokenHash(value), keyId],
    );
    return value;
  }
}
