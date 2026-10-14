import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PoolClient } from "pg";
import { hash as passwordHash } from "argon2";
import { Database } from "../database/database";
import {
  Signing,
  devicePublicKey,
  verifyDeviceProof,
} from "../signing/signing";
import { Security } from "../security/security";
import { Audit, Actor } from "../audit/audit";
import { requireCondition } from "../common/errors";
import { challengeSchema, Proof } from "../common/schemas";
import { token } from "../security/crypto";
import { z } from "zod";

interface Pairing {
  id: string;
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
  ) {}
  async challenge(input: z.infer<typeof challengeSchema>) {
    const key = devicePublicKey(input.device_public_key);
    requireCondition(
      (input.purpose === "CONFIRM") === !!input.pairing_id,
      "INVALID_REQUEST",
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
      const id = randomUUID(),
        secret = token();
      await c.query(
        `INSERT INTO pairings(id,fingerprint_digest,public_key,key_digest,secret_hash,status,expires_at)
        VALUES($1,$2,$3,$4,$5,'PENDING',now()+interval '5 minutes')`,
        [
          id,
          row.fingerprint_digest,
          row.public_key,
          row.key_digest,
          this.security.tokenHash(secret),
        ],
      );
      await this.audit.append(c, actor, "pairing.created", id);
      return {
        pairing_id: id,
        pairing_secret: secret,
        expires_at: new Date(Date.now() + 300000).toISOString(),
      };
    });
  }
  async browserConfirm(
    id: string,
    secret: string,
    customerId: string | undefined,
    actor: Actor,
  ) {
    return this.db.transaction(async (c) => {
      const r = await c.query<Pairing>(
        "SELECT * FROM pairings WHERE id=$1 FOR UPDATE",
        [id],
      );
      const p = r.rows[0];
      requireCondition(
        p &&
          p.status === "PENDING" &&
          p.expires_at.getTime() > Date.now() &&
          p.secret_hash === this.security.tokenHash(secret),
        "PAIRING_INVALID",
        410,
      );
      if (customerId) {
        const owner = await c.query<{ fingerprint_digest: string }>(
          `SELECT d.fingerprint_digest FROM customers c JOIN devices d ON d.id=c.device_id
          WHERE c.id=$1 AND c.state='ACTIVE' AND c.generation=d.generation`,
          [customerId],
        );
        requireCondition(
          owner.rows[0]?.fingerprint_digest === p.fingerprint_digest,
          "PROFILE_NOT_AUTHORIZED",
          403,
        );
      }
      const browser = token();
      await c.query(
        "UPDATE pairings SET status='BROWSER_CONFIRMED',browser_hash=$2,authorized_customer_id=$3 WHERE id=$1",
        [id, this.security.tokenHash(browser), customerId ?? null],
      );
      await this.audit.append(c, actor, "pairing.browser_confirmed", id);
      return { browser_token: browser };
    });
  }
  async desktopConfirm(id: string, p: Proof, actor: Actor) {
    return this.db.transaction(async (c) => {
      const row = await this.proof(c, p, "CONFIRM", id);
      const r = await c.query<Pairing>(
        "SELECT * FROM pairings WHERE id=$1 FOR UPDATE",
        [id],
      );
      const pair = r.rows[0];
      requireCondition(
        pair &&
          pair.status === "BROWSER_CONFIRMED" &&
          pair.expires_at.getTime() > Date.now() &&
          pair.key_digest === row.key_digest &&
          pair.fingerprint_digest === row.fingerprint_digest,
        "PAIRING_INVALID",
        410,
      );
      const grant = token();
      await c.query(
        "UPDATE pairings SET status='DESKTOP_CONFIRMED',claim_hash=$2 WHERE id=$1",
        [id, this.security.tokenHash(grant)],
      );
      await this.audit.append(c, actor, "pairing.desktop_confirmed", id);
      return { claim_grant: grant };
    });
  }
  async claim(
    id: string,
    browser: string,
    grant: string,
    password: string | undefined,
    actor: Actor,
  ) {
    const encoded = password
      ? await passwordHash(password, {
          type: 2,
          memoryCost: 65536,
          timeCost: 3,
          parallelism: 1,
        })
      : null;
    return this.db.transaction(async (c) => {
      const r = await c.query<Pairing>(
        "SELECT * FROM pairings WHERE id=$1 FOR UPDATE",
        [id],
      );
      const p = r.rows[0];
      requireCondition(
        p &&
          p.status === "DESKTOP_CONFIRMED" &&
          p.expires_at.getTime() > Date.now() &&
          p.browser_hash === this.security.tokenHash(browser) &&
          p.claim_hash === this.security.tokenHash(grant),
        "PAIRING_INVALID",
        410,
      );
      // Serializes first-claim and reset/key races without trusting a claimed HWID as authentication.
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        p.fingerprint_digest,
      ]);
      const username =
        "YZ-" + p.fingerprint_digest.slice(0, 24).match(/.{4}/g)!.join("-");
      await c.query(
        "INSERT INTO devices(id,fingerprint_version,fingerprint_digest,username) VALUES($1,2,$2,$3) ON CONFLICT(fingerprint_version,fingerprint_digest) DO NOTHING",
        [randomUUID(), p.fingerprint_digest, username],
      );
      const d = (
        await c.query<{ id: string; generation: number }>(
          "SELECT id,generation FROM devices WHERE fingerprint_digest=$1 FOR UPDATE",
          [p.fingerprint_digest],
        )
      ).rows[0];
      let customer = (
        await c.query<{ id: string }>(
          "SELECT id FROM customers WHERE device_id=$1 AND state='ACTIVE'",
          [d.id],
        )
      ).rows[0];
      if (customer) {
        requireCondition(
          p.authorized_customer_id === customer.id,
          "PROFILE_NOT_AUTHORIZED",
          403,
        );
      } else {
        requireCondition(
          !p.authorized_customer_id && encoded,
          "PASSWORD_REQUIRED",
        );
        // Configuration rejects production. A paired software key is NOT proof of physical ownership.
        customer = { id: randomUUID() };
        await c.query(
          "INSERT INTO customers(id,device_id,generation,username,password_hash,state) VALUES($1,$2,$3,$4,$5,'ACTIVE')",
          [customer.id, d.id, d.generation, username, encoded],
        );
      }
      const existing = (
        await c.query<{ id: string; device_id: string; generation: number }>(
          "SELECT id,device_id,generation FROM device_keys WHERE key_digest=$1 FOR UPDATE",
          [p.key_digest],
        )
      ).rows[0];
      requireCondition(
        !existing ||
          (existing.device_id === d.id && existing.generation < d.generation),
        "KEY_ALREADY_ENROLLED",
        409,
      );
      const keyId = existing?.id ?? randomUUID();
      const enrollment = this.signing.artifact("enrollment", {
        device_id: d.id,
        device_fingerprint_version: 2,
        device_fingerprint_digest: p.fingerprint_digest,
        device_key_digest: p.key_digest,
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
          p.public_key,
          p.key_digest,
          enrollment,
        ],
      );
      await c.query("UPDATE pairings SET status='CONSUMED' WHERE id=$1", [id]);
      const credential = await this.credential(c, keyId);
      await this.audit.append(c, actor, "enrollment.approved", d.id, {
        profile_enrollment_id: keyId,
        generation: d.generation,
      });
      return {
        device_id: d.id,
        customer_id: customer.id,
        username,
        enrollment,
        credential,
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
          fingerprint_digest: string;
        }>(
          `SELECT k.id,k.device_id,k.status,d.fingerprint_digest FROM device_keys k JOIN devices d ON d.id=k.device_id WHERE key_digest=$1`,
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
        scope: k.status === "ACTIVE" ? "desktop" : "tombstone_only",
      };
    });
  }
  private async credential(c: PoolClient, keyId: string) {
    const value = token();
    await c.query(
      `INSERT INTO device_credentials(token_hash,key_id,expires_at) VALUES($1,$2,now()+interval '15 minutes')`,
      [this.security.tokenHash(value), keyId],
    );
    return value;
  }
}
