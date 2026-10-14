import { Injectable } from "@nestjs/common";
import { Database } from "../database/database";

export interface OutboxEvent {
  id: string;
  type: string;
  aggregate_id: string;
  payload_redacted: Record<string, unknown>;
}
@Injectable()
export class Outbox {
  constructor(private db: Database) {}
  // Consumers must deduplicate event IDs: crash after delivery before commit can redeliver.
  // No external consumer or automatic background delivery is enabled in Phase 2.
  async dispatch(deliver: (event: OutboxEvent) => Promise<void>, limit = 20) {
    if (limit < 1 || limit > 100) throw new Error("OUTBOX_BATCH_INVALID");
    return this.db.transaction(async (c) => {
      const rows = await c.query<OutboxEvent>(
        "SELECT id,type,aggregate_id,payload_redacted FROM outbox_events WHERE processed_at IS NULL ORDER BY created_at,id LIMIT $1 FOR UPDATE SKIP LOCKED",
        [limit],
      );
      let sent = 0;
      for (const event of rows.rows) {
        try {
          await deliver(event);
          await c.query(
            "UPDATE outbox_events SET processed_at=now(),attempts=attempts+1 WHERE id=$1",
            [event.id],
          );
          sent++;
        } catch {
          await c.query(
            "UPDATE outbox_events SET attempts=attempts+1 WHERE id=$1",
            [event.id],
          );
        }
      }
      return { sent, attempted: rows.rows.length };
    });
  }
}
