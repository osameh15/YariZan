CREATE EXTENSION IF NOT EXISTS pg_trgm;
ALTER TABLE customers ADD COLUMN mobile_ciphertext text, ADD COLUMN mobile_lookup text, ADD COLUMN mobile_last4 text, ADD COLUMN mobile_verified_at timestamptz;
ALTER TABLE customers ADD CONSTRAINT customer_mobile_complete CHECK ((mobile_ciphertext IS NULL AND mobile_lookup IS NULL AND mobile_last4 IS NULL AND mobile_verified_at IS NULL) OR (mobile_ciphertext IS NOT NULL AND mobile_lookup ~ '^[a-f0-9]{64}$' AND mobile_last4 ~ '^[0-9]{4}$' AND mobile_verified_at IS NOT NULL));
CREATE INDEX customers_mobile_lookup ON customers(mobile_lookup) WHERE state='ACTIVE';
ALTER TABLE admins ADD COLUMN mobile_ciphertext text, ADD COLUMN mobile_last4 text;
ALTER TABLE admins ADD CONSTRAINT admin_mobile_complete CHECK ((mobile_ciphertext IS NULL AND mobile_last4 IS NULL) OR (mobile_ciphertext IS NOT NULL AND mobile_last4 ~ '^[0-9]{4}$'));
CREATE TABLE otp_challenges (
 id uuid PRIMARY KEY, purpose text NOT NULL CHECK(purpose IN ('CLAIM','LOGIN','RESET','PASSWORD','MOBILE_OLD','MOBILE_NEW','ADMIN')),
 principal_id uuid, pairing_id uuid REFERENCES pairings ON DELETE RESTRICT, generation integer, session_hash text,
 mobile_ciphertext text NOT NULL, mobile_lookup text NOT NULL, code_hash text NOT NULL, principal_stamp text,
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5), delivered boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, used_at timestamptz,
 CHECK(expires_at>created_at), CHECK(code_hash ~ '^[a-f0-9]{64}$'), CHECK(mobile_lookup ~ '^[a-f0-9]{64}$')
);
CREATE INDEX otp_expiry ON otp_challenges(expires_at) WHERE used_at IS NULL;
CREATE INDEX otp_principal ON otp_challenges(principal_id,purpose,created_at DESC);
CREATE TABLE entity_notes (
 entity_type text NOT NULL CHECK(entity_type IN ('customers','devices','licenses','activation-codes','trials','products')),
 entity_id text NOT NULL CHECK(length(entity_id) BETWEEN 1 AND 128), note text NOT NULL CHECK(length(note)<=2000),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision BETWEEN 1 AND 9007199254740991),
 updated_by uuid NOT NULL REFERENCES admins ON DELETE RESTRICT, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(entity_type,entity_id)
);
CREATE INDEX entity_notes_text_search ON entity_notes USING gin(note gin_trgm_ops);
CREATE INDEX devices_username_search ON devices USING gin(username gin_trgm_ops);
CREATE INDEX customers_username_search ON customers USING gin(username gin_trgm_ops);
INSERT INTO admin_roles(name) VALUES('owner'),('support') ON CONFLICT DO NOTHING;
INSERT INTO admin_permissions(name) VALUES('notes.manage') ON CONFLICT DO NOTHING;
INSERT INTO admin_role_permissions(role,permission) VALUES('owner','notes.manage'),('support','notes.manage') ON CONFLICT DO NOTHING;

ALTER TABLE entity_notes
 ADD COLUMN customer_id uuid GENERATED ALWAYS AS (CASE WHEN entity_type='customers' THEN entity_id::uuid END) STORED REFERENCES customers ON DELETE RESTRICT,
 ADD COLUMN device_id uuid GENERATED ALWAYS AS (CASE WHEN entity_type='devices' THEN entity_id::uuid WHEN entity_type='trials' THEN split_part(entity_id,'~',1)::uuid END) STORED REFERENCES devices ON DELETE RESTRICT,
 ADD COLUMN license_id uuid GENERATED ALWAYS AS (CASE WHEN entity_type='licenses' THEN entity_id::uuid END) STORED REFERENCES licenses ON DELETE RESTRICT,
 ADD COLUMN activation_code_id uuid GENERATED ALWAYS AS (CASE WHEN entity_type='activation-codes' THEN entity_id::uuid END) STORED REFERENCES activation_codes ON DELETE RESTRICT,
 ADD COLUMN sku text GENERATED ALWAYS AS (CASE WHEN entity_type='products' THEN entity_id WHEN entity_type='trials' THEN split_part(entity_id,'~',2) END) STORED REFERENCES products ON DELETE RESTRICT,
 ADD COLUMN trial_generation integer GENERATED ALWAYS AS (CASE WHEN entity_type='trials' THEN split_part(entity_id,'~',3)::integer END) STORED,
 ADD CONSTRAINT note_trial_reference FOREIGN KEY(device_id,sku,trial_generation) REFERENCES trial_counters(device_id,sku,generation) ON DELETE RESTRICT;

CREATE INDEX devices_id_search ON devices USING gin((id::text) gin_trgm_ops);
CREATE INDEX customers_id_search ON customers USING gin((id::text) gin_trgm_ops);
CREATE INDEX device_keys_id_search ON device_keys USING gin((id::text) gin_trgm_ops);
CREATE INDEX licenses_id_search ON licenses USING gin((id::text) gin_trgm_ops);
CREATE INDEX activation_codes_id_search ON activation_codes USING gin((id::text) gin_trgm_ops);

ALTER TABLE otp_challenges
 ADD COLUMN customer_id uuid GENERATED ALWAYS AS (CASE WHEN purpose IN ('LOGIN','RESET','PASSWORD','MOBILE_OLD','MOBILE_NEW') THEN principal_id END) STORED REFERENCES customers ON DELETE RESTRICT,
 ADD COLUMN admin_id uuid GENERATED ALWAYS AS (CASE WHEN purpose='ADMIN' THEN principal_id END) STORED REFERENCES admins ON DELETE RESTRICT,
 ADD CONSTRAINT otp_lifetime CHECK(expires_at<=created_at+interval '5 minutes'),
 ADD CONSTRAINT otp_generation CHECK(generation IS NULL OR generation>0),
 ADD CONSTRAINT otp_purpose_binding CHECK(
  (purpose='CLAIM' AND pairing_id IS NOT NULL AND generation IS NOT NULL AND principal_id IS NULL AND session_hash IS NULL)
  OR (purpose IN ('LOGIN','RESET') AND pairing_id IS NULL AND session_hash IS NULL AND ((principal_id IS NULL AND generation IS NULL) OR (principal_id IS NOT NULL AND generation IS NOT NULL)))
  OR (purpose='ADMIN' AND principal_id IS NOT NULL AND pairing_id IS NULL AND generation IS NULL AND session_hash IS NULL)
  OR (purpose IN ('PASSWORD','MOBILE_OLD','MOBILE_NEW') AND principal_id IS NOT NULL AND generation IS NOT NULL AND session_hash IS NOT NULL AND pairing_id IS NULL)
 );

-- Existing password accounts may enroll a first phone; all new active claims require verified mobile.
ALTER TABLE customers ADD COLUMN mobile_setup_required boolean NOT NULL DEFAULT false;
ALTER TABLE customers ALTER COLUMN mobile_setup_required SET DEFAULT true;
ALTER TABLE customers ADD CONSTRAINT new_account_mobile_required CHECK(state<>'ACTIVE' OR NOT mobile_setup_required OR mobile_verified_at IS NOT NULL);
-- Retire pre-SMS Admin sessions during the authentication transition.
UPDATE admin_sessions SET revoked_at=COALESCE(revoked_at,now());
ALTER TABLE admin_sessions ADD COLUMN mfa_method text NOT NULL DEFAULT 'LEGACY_TOTP';
ALTER TABLE admin_sessions ALTER COLUMN mfa_method DROP DEFAULT;
ALTER TABLE admin_sessions ADD CONSTRAINT admin_sms_session CHECK(mfa_method='SMS' OR (mfa_method='LEGACY_TOTP' AND revoked_at IS NOT NULL));
