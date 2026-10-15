-- Credentials retain issuance authority even if a profile key is approved again after reset.
ALTER TABLE device_credentials ADD COLUMN customer_id uuid;
ALTER TABLE device_credentials ADD COLUMN device_id uuid;
ALTER TABLE device_credentials ADD COLUMN generation integer;
UPDATE device_credentials c SET customer_id=k.customer_id,device_id=k.device_id,generation=k.generation
 FROM device_keys k WHERE k.id=c.key_id;
UPDATE device_credentials SET expires_at=LEAST(expires_at,now()) WHERE revoked_at IS NOT NULL;
-- Pre-migration revoked credentials stay revoked and can never regain ACTIVE scope.
ALTER TABLE device_credentials ALTER COLUMN customer_id SET NOT NULL;
ALTER TABLE device_credentials ALTER COLUMN device_id SET NOT NULL;
ALTER TABLE device_credentials ALTER COLUMN generation SET NOT NULL;
ALTER TABLE device_credentials ADD CONSTRAINT credential_customer_scope FOREIGN KEY(customer_id,device_id,generation)
 REFERENCES customers(id,device_id,generation) ON DELETE RESTRICT;
CREATE INDEX credentials_customer ON device_credentials(customer_id);
CREATE FUNCTION immutable_credential_authority() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.token_hash,NEW.key_id,NEW.customer_id,NEW.device_id,NEW.generation)
  IS DISTINCT FROM (OLD.token_hash,OLD.key_id,OLD.customer_id,OLD.device_id,OLD.generation)
 THEN RAISE EXCEPTION 'Credential authority cannot change'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER credential_authority_immutable BEFORE UPDATE ON device_credentials FOR EACH ROW EXECUTE FUNCTION immutable_credential_authority();
