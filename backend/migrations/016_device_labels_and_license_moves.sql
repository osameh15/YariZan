-- Customer-chosen device names, and moving a paid license between devices of one verified mobile.
-- A moved license becomes a new TRANSFER entitlement on the target device that points at the
-- entitlement it replaces; the source entitlement is revoked, never deleted.
ALTER TABLE customers ADD COLUMN device_label text
 CHECK (device_label IS NULL OR (char_length(device_label) BETWEEN 1 AND 40 AND device_label = btrim(device_label)));
ALTER TABLE entitlements DROP CONSTRAINT entitlements_source_type_check;
ALTER TABLE entitlements ADD CONSTRAINT entitlements_source_type_check
 CHECK (source_type IN ('ADMIN','CODE','PURCHASE','TRANSFER'));
ALTER TABLE entitlements ADD COLUMN transferred_from uuid UNIQUE REFERENCES entitlements ON DELETE RESTRICT;
ALTER TABLE entitlements ADD CONSTRAINT entitlements_transfer_source
 CHECK ((source_type = 'TRANSFER') = (transferred_from IS NOT NULL) AND transferred_from IS DISTINCT FROM id);
