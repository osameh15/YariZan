import { randomUUID } from "node:crypto";
import { PoolClient } from "pg";
/** Called only after a successful new sign-in, inside the session's transaction.
 * Dedicated event names avoid notifying users about historical audit events at deployment. */
export async function queueLoginNotice(
  c: PoolClient,
  kind: "customer" | "admin",
  id: string,
) {
  await c.query(
    "INSERT INTO outbox_events(id,type,aggregate_id,payload_redacted) VALUES($1,$2,$3,'{}'::jsonb)",
    [randomUUID(), `${kind}.login_notice`, id],
  );
}
