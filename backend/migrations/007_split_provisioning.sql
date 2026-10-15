-- Retire the old credential-to-browser protocol; retain historical rows and invalidate pending grants.
UPDATE pairings SET status='CONSUMED',expires_at=LEAST(expires_at,now()),browser_hash=NULL,claim_hash=NULL;
ALTER TABLE pairings ADD COLUMN device_id uuid REFERENCES devices ON DELETE RESTRICT;
ALTER TABLE pairings ADD COLUMN generation integer CHECK(generation>0);
ALTER TABLE pairings ADD COLUMN protocol smallint NOT NULL DEFAULT 2 CHECK(protocol IN (2,3));
ALTER TABLE pairings ADD COLUMN cancelled_at timestamptz;
ALTER TABLE pairings ADD CONSTRAINT pairing_approval_scope FOREIGN KEY(authorized_customer_id,device_id,generation)
 REFERENCES customers(id,device_id,generation) ON DELETE RESTRICT;
ALTER TABLE pairings ADD CONSTRAINT pairing_v3_anchor CHECK(protocol=2 OR (device_id IS NOT NULL AND generation IS NOT NULL));
CREATE INDEX pairings_device_generation ON pairings(device_id,generation);
