// Least-privilege grants for the runtime login. Applied by the migration owner after every
// migration, so tables added by later migrations are covered. The runtime role gets no DDL,
// no TRUNCATE, no DELETE except where the application deletes rows, and read-only access to
// migration metadata and immutable history tables.
export const runtimeRole = "yarizan_runtime";
export const runtimeGrantsSql = `
GRANT USAGE ON SCHEMA public TO yarizan_runtime;
REVOKE CREATE ON SCHEMA public FROM yarizan_runtime;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO yarizan_runtime;
REVOKE ALL ON schema_migrations FROM yarizan_runtime;
GRANT SELECT ON schema_migrations TO yarizan_runtime;
REVOKE UPDATE ON audit_logs,license_decisions,trial_starts,activation_redemptions,customer_reset_events,license_recoveries,admin_operations,payment_events,device_enrollment_history,product_promotion_events,payment_inquiries FROM yarizan_runtime;
GRANT DELETE ON discount_products TO yarizan_runtime;
-- Expired rate counters only (Abuse.purge); TRUNCATE stays denied.
GRANT DELETE ON rate_buckets TO yarizan_runtime;
-- Devices with no history at all (Admin removal of test devices); every reference is ON DELETE RESTRICT.
GRANT DELETE ON devices TO yarizan_runtime;
`;
