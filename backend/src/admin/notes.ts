import { Injectable } from "@nestjs/common";
import { Request } from "express";
import { Database } from "../database/database";
import { Security } from "../security/security";
import { Audit } from "../audit/audit";
import { requireCondition } from "../common/errors";
import { z } from "zod";
import { uuid, sku } from "../common/schemas";
export const noteTypes = z.enum([
  "customers",
  "devices",
  "licenses",
  "activation-codes",
  "trials",
  "products",
  "orders",
  "payments",
  "campaigns",
  "coupons",
]);
const permissions: Record<string, string> = {
  orders: "commerce.read",
  payments: "commerce.read",
  campaigns: "commerce.read",
  coupons: "commerce.read",
  customers: "customers.read",
  devices: "devices.read",
  licenses: "licenses.read",
  "activation-codes": "activation_codes.read",
  trials: "trials.read",
  products: "products.manage",
};
@Injectable()
export class Notes {
  constructor(
    private db: Database,
    private security: Security,
    private audit: Audit,
  ) {}
  async save(
    req: Request,
    type: string,
    id: string,
    note: string,
    revision: number,
  ) {
    type = noteTypes.parse(type);
    const trial = type === "trials" ? id.split("~") : undefined;
    if (type === "products") sku.parse(id);
    else if (trial) {
      z.tuple([uuid, sku, z.string().regex(/^[1-9][0-9]{0,8}$/)]).parse(trial);
    } else uuid.parse(id);
    return this.db.transaction(async (c) => {
      const a = await this.security.admin(req, "notes.manage", c);
      await this.security.admin(req, permissions[type], c);
      const commercial: Record<string, string> = {
        payments: "payment_attempts",
        campaigns: "discount_campaigns",
        coupons: "discount_codes",
      };
      const table =
        commercial[type] ??
        (type === "activation-codes"
          ? "activation_codes"
          : type === "trials"
            ? "trial_counters"
            : type);
      const found = trial
        ? await c.query(
            "SELECT 1 FROM trial_counters WHERE device_id=$1 AND sku=$2 AND generation=$3 FOR SHARE",
            trial,
          )
        : await c.query(
            `SELECT 1 FROM ${table} WHERE ${type === "products" ? "sku" : "id"}=$1 FOR SHARE`,
            [id],
          );
      requireCondition(found.rowCount, "NOT_FOUND", 404);
      await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        "note:" + type + ":" + id,
      ]);
      const current = (
        await c.query<{ revision: string }>(
          "SELECT revision FROM entity_notes WHERE entity_type=$1 AND entity_id=$2 FOR UPDATE",
          [type, id],
        )
      ).rows[0];
      requireCondition(
        Number(current?.revision ?? 0) === revision,
        "STALE_REVISION",
        409,
      );
      const r = await c.query(
        "INSERT INTO entity_notes(entity_type,entity_id,note,updated_by) VALUES($1,$2,$3,$4) ON CONFLICT(entity_type,entity_id) DO UPDATE SET note=EXCLUDED.note,updated_by=EXCLUDED.updated_by,updated_at=now(),revision=entity_notes.revision+1 RETURNING note,revision",
        [type, id, note, a.id],
      );
      await this.audit.append(
        c,
        {
          type: "ADMIN",
          id: a.id,
          correlationId: req.res!.locals.correlationId,
        },
        current ? "note.updated" : "note.created",
        id,
        { entity_type: type, revision: Number(r.rows[0].revision) },
      );
      return { note: r.rows[0].note, revision: Number(r.rows[0].revision) };
    });
  }
}
