ALTER TABLE devices ADD CONSTRAINT username_matches_digest CHECK
 (username='YZ-'||substr(fingerprint_digest,1,4)||'-'||substr(fingerprint_digest,5,4)||'-'||substr(fingerprint_digest,9,4)||'-'||substr(fingerprint_digest,13,4)||'-'||substr(fingerprint_digest,17,4)||'-'||substr(fingerprint_digest,21,4));
ALTER TABLE customers ADD CONSTRAINT customer_username_format CHECK(username ~ '^YZ-([A-F0-9]{4}-){5}[A-F0-9]{4}$');
ALTER TABLE products ADD CONSTRAINT availability_matches_publication CHECK
 (publication_status='published' OR (NOT sale_enabled AND NOT trial_enabled AND NOT activation_enabled));
ALTER TABLE entitlements ADD UNIQUE(id,device_id,sku);
ALTER TABLE licenses ADD CONSTRAINT license_entitlement_scope FOREIGN KEY(entitlement_id,device_id,sku)
 REFERENCES entitlements(id,device_id,sku) ON DELETE RESTRICT;
ALTER TABLE licenses ADD CHECK(fingerprint_digest ~ '^[A-F0-9]{64}$');
ALTER TABLE activation_redemptions ADD CONSTRAINT redemption_customer_generation FOREIGN KEY(device_id,generation)
 REFERENCES customers(device_id,generation) ON DELETE RESTRICT;
ALTER TABLE trial_counters ADD CONSTRAINT trial_customer_generation FOREIGN KEY(device_id,generation)
 REFERENCES customers(device_id,generation) ON DELETE RESTRICT;
CREATE TRIGGER recoveries_immutable BEFORE UPDATE OR DELETE ON license_recoveries FOR EACH ROW EXECUTE FUNCTION immutable_history();
CREATE TRIGGER operations_immutable BEFORE UPDATE OR DELETE ON admin_operations FOR EACH ROW EXECUTE FUNCTION immutable_history();
CREATE INDEX keys_customer ON device_keys(customer_id);
CREATE INDEX licenses_device_product ON licenses(device_id,sku);
CREATE INDEX entitlements_customer ON entitlements(customer_id);
CREATE INDEX pairing_expiry ON pairings(expires_at);
