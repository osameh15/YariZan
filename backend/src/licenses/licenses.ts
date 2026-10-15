import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PoolClient } from "pg";
import { Database } from "../database/database";
import { Security, DeviceContext } from "../security/security";
import { Signing, Envelope } from "../signing/signing";
import { requireCondition } from "../common/errors";
import { Audit, Actor } from "../audit/audit";

export interface LicenseRow {
  id: string;
  entitlement_id: string;
  device_id: string;
  sku: string;
  fingerprint_digest: string;
  signed_license: Envelope;
  state: string;
  decision_version: string;
  signed_decision: Envelope;
}
@Injectable()
export class Licenses {
  constructor(
    private db: Database,
    private security: Security,
    private signing: Signing,
    private audit: Audit,
  ) {}
  async issue(
    c: PoolClient,
    d: DeviceContext,
    sku: string,
    source: "ADMIN" | "CODE",
    actor: Actor,
  ) {
    await this.security.product(c, d, sku, "activation");
    let e = (
      await c.query<{ id: string }>(
        "SELECT id FROM entitlements WHERE device_id=$1 AND sku=$2 AND generation=$3 AND state='ACTIVE' FOR UPDATE",
        [d.device_id, sku, d.generation],
      )
    ).rows[0];
    if (!e) {
      e = { id: randomUUID() };
      await c.query(
        "INSERT INTO entitlements(id,customer_id,device_id,generation,sku,source_type) VALUES($1,$2,$3,$4,$5,$6)",
        [e.id, d.customer_id, d.device_id, d.generation, sku, source],
      );
    }
    return this.ensureLicense(c, d, sku, e.id, actor);
  }
  async ensureLicense(
    c: PoolClient,
    d: DeviceContext,
    sku: string,
    entitlementId: string,
    actor: Actor,
  ) {
    const prior = (
      await c.query<LicenseRow>(
        "SELECT * FROM licenses WHERE entitlement_id=$1 FOR UPDATE",
        [entitlementId],
      )
    ).rows[0];
    if (prior) {
      requireCondition(prior.state === "ACTIVE", "LICENSE_REVOKED", 403);
      return prior.signed_license;
    }
    const id = randomUUID();
    const grade = Number(sku.slice(-1));
    const artifact = this.signing.artifact("license", {
      license_id: id,
      customer_id: d.customer_id,
      device_id: d.device_id,
      sku,
      grade,
      device_fingerprint_version: 2,
      device_fingerprint_digest: d.fingerprint_digest,
      expires_at: null,
      license_revision: 1,
    });
    const decision = this.decision(
      id,
      d.device_id,
      sku,
      d.fingerprint_digest,
      1,
      "ACTIVE",
    );
    await c.query(
      "INSERT INTO licenses(id,entitlement_id,device_id,sku,fingerprint_digest,signed_license,signed_decision) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        id,
        entitlementId,
        d.device_id,
        sku,
        d.fingerprint_digest,
        artifact,
        decision,
      ],
    );
    await c.query(
      "INSERT INTO license_decisions(license_id,version,signed_decision) VALUES($1,1,$2)",
      [id, decision],
    );
    await this.audit.append(c, actor, "license.issued", id, { sku });
    return artifact;
  }
  async pickup(bearer: string, sku: string, actor: Actor) {
    return this.db.transaction(async (c) => {
      const d = await this.security.device(c, bearer);
      await this.security.product(c, d, sku);
      const e = (
        await c.query<{ id: string }>(
          "SELECT id FROM entitlements WHERE device_id=$1 AND sku=$2 AND generation=$3 AND state='ACTIVE' FOR UPDATE",
          [d.device_id, sku, d.generation],
        )
      ).rows[0];
      requireCondition(e, "ENTITLEMENT_REQUIRED", 403);
      const existing = (
        await c.query<LicenseRow>(
          "SELECT * FROM licenses WHERE entitlement_id=$1",
          [e.id],
        )
      ).rows[0];
      if (existing) {
        requireCondition(existing.state === "ACTIVE", "LICENSE_REVOKED", 403);
        return existing.signed_license;
      }
      await this.security.product(c, d, sku, "activation");
      return this.ensureLicense(c, d, sku, e.id, actor);
    });
  }
  async sync(bearer: string, id: string, sku: string) {
    return this.db.transaction(async (c) => {
      const d = await this.security.device(c, bearer, true);
      const l = (
        await c.query<LicenseRow>(
          "SELECT * FROM licenses WHERE id=$1 AND device_id=$2 AND sku=$3 FOR UPDATE",
          [id, d.device_id, sku],
        )
      ).rows[0];
      requireCondition(l, "LICENSE_NOT_FOUND", 404);
      const generation = (
        await c.query<{
          generation: number;
          customer_id: string;
          state: string;
        }>(
          "SELECT generation,customer_id,state FROM entitlements WHERE id=$1",
          [l.entitlement_id],
        )
      ).rows[0];
      // Historical credentials can retrieve revocations only, never a new account or ACTIVE recovery.
      if (d.historical)
        requireCondition(
          l.state === "REVOKED" &&
            generation.customer_id === d.customer_id &&
            generation.generation === d.generation,
          "ACCOUNT_RESTRICTED",
          403,
        );
      const k = (
        await c.query<{ status: string }>(
          "SELECT status FROM device_keys WHERE id=$1",
          [d.key_id],
        )
      ).rows[0];
      requireCondition(
        l.state === "REVOKED" ||
          (!d.historical &&
            k.status === "ACTIVE" &&
            generation.customer_id === d.customer_id &&
            generation.generation === d.generation),
        "ACCOUNT_RESTRICTED",
        403,
      );
      return l.signed_decision;
    });
  }
  decision(
    id: string,
    device: string,
    sku: string,
    fingerprint: string,
    version: number,
    status: "ACTIVE" | "REVOKED",
  ) {
    return this.signing.artifact("decision", {
      license_id: id,
      device_id: device,
      sku,
      device_fingerprint_version: 2,
      device_fingerprint_digest: fingerprint,
      decision_version: version,
      status,
    });
  }
  async change(
    c: PoolClient,
    l: LicenseRow,
    status: "ACTIVE" | "REVOKED",
    actor: Actor,
  ) {
    const version = Number(l.decision_version) + 1;
    requireCondition(Number.isSafeInteger(version), "REVISION_EXHAUSTED", 409);
    const decision = this.decision(
      l.id,
      l.device_id,
      l.sku,
      l.fingerprint_digest,
      version,
      status,
    );
    await c.query(
      "UPDATE licenses SET state=$2,decision_version=$3,signed_decision=$4 WHERE id=$1",
      [l.id, status, version, decision],
    );
    await c.query(
      "INSERT INTO license_decisions(license_id,version,signed_decision) VALUES($1,$2,$3)",
      [l.id, version, decision],
    );
    await this.audit.append(c, actor, "license." + status.toLowerCase(), l.id);
    return decision;
  }
}
