import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PoolClient } from "pg";

export type Actor = {
  type: "DEVICE" | "CUSTOMER" | "ADMIN" | "SYSTEM";
  id?: string;
  correlationId: string;
};
@Injectable()
export class Audit {
  async append(
    c: PoolClient,
    actor: Actor,
    action: string,
    entity: string,
    metadata: Record<string, unknown> = {},
  ) {
    await c.query(
      "INSERT INTO audit_logs(id,actor_type,actor_id,action,entity_id,correlation_id,metadata_redacted) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        randomUUID(),
        actor.type,
        actor.id ?? null,
        action,
        entity,
        actor.correlationId,
        metadata,
      ],
    );
    await c.query(
      "INSERT INTO outbox_events(id,type,aggregate_id,payload_redacted) VALUES($1,$2,$3,$4)",
      [randomUUID(), action, entity, { correlation_id: actor.correlationId }],
    );
  }
}
