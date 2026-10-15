CREATE TABLE products (
 sku text PRIMARY KEY CHECK (sku ~ '^YARIZAN-G[1-6]$'),
 grade smallint NOT NULL UNIQUE CHECK (grade BETWEEN 1 AND 6),
 title_fa text NOT NULL,
 publication_status text NOT NULL CHECK (publication_status IN ('published','coming_soon','hidden')),
 sale_enabled boolean NOT NULL DEFAULT false,
 trial_enabled boolean NOT NULL DEFAULT false,
 activation_enabled boolean NOT NULL DEFAULT false,
 revision bigint NOT NULL DEFAULT 1 CHECK (revision BETWEEN 1 AND 9007199254740991),
 CHECK (sku='YARIZAN-G'||grade)
);
CREATE TABLE devices (
 id uuid PRIMARY KEY,
 fingerprint_version smallint NOT NULL CHECK (fingerprint_version=2),
 fingerprint_digest text NOT NULL CHECK (fingerprint_digest ~ '^[A-F0-9]{64}$'),
 username text NOT NULL UNIQUE CHECK (username ~ '^YZ-([A-F0-9]{4}-){5}[A-F0-9]{4}$'),
 generation integer NOT NULL DEFAULT 1 CHECK (generation>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(fingerprint_version,fingerprint_digest), UNIQUE(id,generation)
);
CREATE TABLE customers (
 id uuid PRIMARY KEY, device_id uuid NOT NULL REFERENCES devices ON DELETE RESTRICT,
 generation integer NOT NULL CHECK (generation>0), username text NOT NULL,
 password_hash text, state text NOT NULL CHECK(state IN ('ACTIVE','RESET')),
 claimed_at timestamptz NOT NULL DEFAULT now(), reset_at timestamptz,
 UNIQUE(device_id,generation), UNIQUE(id,device_id,generation)
);
CREATE UNIQUE INDEX customers_active_device ON customers(device_id) WHERE state='ACTIVE';
CREATE UNIQUE INDEX customers_active_username ON customers(username) WHERE state='ACTIVE';
CREATE TABLE device_keys (
 id uuid PRIMARY KEY, device_id uuid NOT NULL REFERENCES devices ON DELETE RESTRICT,
 generation integer NOT NULL CHECK(generation>0), customer_id uuid NOT NULL,
 public_key text NOT NULL, key_digest text NOT NULL UNIQUE CHECK(key_digest ~ '^[A-F0-9]{64}$'),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','REVOKED','REPLACED')),
 signed_enrollment jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(customer_id,device_id,generation) REFERENCES customers(id,device_id,generation) ON DELETE RESTRICT
);
CREATE TABLE device_credentials (
 token_hash text PRIMARY KEY, key_id uuid NOT NULL REFERENCES device_keys ON DELETE RESTRICT,
 expires_at timestamptz NOT NULL, revoked_at timestamptz
);
CREATE TABLE device_challenges (
 id uuid PRIMARY KEY, nonce text NOT NULL, fingerprint_digest text NOT NULL,
 public_key text NOT NULL, key_digest text NOT NULL, purpose text NOT NULL CHECK(purpose IN ('PAIR','AUTH','CONFIRM')),
 pairing_id uuid, expires_at timestamptz NOT NULL, used_at timestamptz,
 CHECK(fingerprint_digest ~ '^[A-F0-9]{64}$'), CHECK(key_digest ~ '^[A-F0-9]{64}$')
);
CREATE TABLE pairings (
 id uuid PRIMARY KEY, fingerprint_digest text NOT NULL, public_key text NOT NULL,
 key_digest text NOT NULL, secret_hash text NOT NULL UNIQUE,
 browser_hash text, claim_hash text UNIQUE, authorized_customer_id uuid REFERENCES customers ON DELETE RESTRICT,
 status text NOT NULL CHECK(status IN ('PENDING','BROWSER_CONFIRMED','DESKTOP_CONFIRMED','CONSUMED')),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE device_challenges ADD FOREIGN KEY(pairing_id) REFERENCES pairings ON DELETE RESTRICT;
CREATE TABLE customer_sessions (
 token_hash text PRIMARY KEY, customer_id uuid NOT NULL REFERENCES customers ON DELETE RESTRICT,
 csrf_hash text NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz
);
CREATE TABLE password_resets (
 id uuid PRIMARY KEY, customer_id uuid NOT NULL REFERENCES customers ON DELETE RESTRICT,
 token_hash text NOT NULL UNIQUE, evidence_ref text NOT NULL, expires_at timestamptz NOT NULL,
 used_at timestamptz
);
CREATE TABLE device_product_restrictions (
 device_id uuid NOT NULL REFERENCES devices ON DELETE RESTRICT, sku text NOT NULL REFERENCES products ON DELETE RESTRICT,
 blocked boolean NOT NULL DEFAULT false, revision bigint NOT NULL DEFAULT 1 CHECK(revision>0 AND revision<=9007199254740991),
 reason text NOT NULL, PRIMARY KEY(device_id,sku)
);
CREATE TABLE trial_counters (
 device_id uuid NOT NULL REFERENCES devices ON DELETE RESTRICT, sku text NOT NULL REFERENCES products ON DELETE RESTRICT,
 generation integer NOT NULL CHECK(generation>0), used smallint NOT NULL DEFAULT 0 CHECK(used BETWEEN 0 AND 2),
 PRIMARY KEY(device_id,sku,generation)
);
CREATE TABLE trial_starts (
 id uuid PRIMARY KEY, device_id uuid NOT NULL, sku text NOT NULL, generation integer NOT NULL,
 nonce text NOT NULL CHECK(nonce ~ '^[A-F0-9]{64}$'), request_digest text NOT NULL,
 response jsonb NOT NULL, started_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(device_id,sku,generation,nonce),
 FOREIGN KEY(device_id,sku,generation) REFERENCES trial_counters ON DELETE RESTRICT
);
CREATE TABLE entitlements (
 id uuid PRIMARY KEY, customer_id uuid NOT NULL, device_id uuid NOT NULL, generation integer NOT NULL,
 sku text NOT NULL REFERENCES products ON DELETE RESTRICT,
 source_type text NOT NULL CHECK(source_type IN ('ADMIN','CODE','PURCHASE')),
 state text NOT NULL DEFAULT 'ACTIVE' CHECK(state IN ('ACTIVE','REVOKED','RESET')),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(customer_id,device_id,generation) REFERENCES customers(id,device_id,generation) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX entitlements_active_product ON entitlements(device_id,sku,generation) WHERE state='ACTIVE';
CREATE TABLE licenses (
 id uuid PRIMARY KEY, entitlement_id uuid NOT NULL UNIQUE REFERENCES entitlements ON DELETE RESTRICT,
 device_id uuid NOT NULL REFERENCES devices ON DELETE RESTRICT, sku text NOT NULL REFERENCES products ON DELETE RESTRICT,
 fingerprint_digest text NOT NULL, signed_license jsonb NOT NULL,
 state text NOT NULL DEFAULT 'ACTIVE' CHECK(state IN ('ACTIVE','REVOKED')),
 license_revision bigint NOT NULL DEFAULT 1 CHECK(license_revision BETWEEN 1 AND 9007199254740991),
 decision_version bigint NOT NULL DEFAULT 1 CHECK(decision_version BETWEEN 1 AND 9007199254740991),
 signed_decision jsonb NOT NULL, issued_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE license_decisions (
 license_id uuid NOT NULL REFERENCES licenses ON DELETE RESTRICT,
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9007199254740991), signed_decision jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(license_id,version)
);
CREATE TABLE activation_codes (
 id uuid PRIMARY KEY, verifier text NOT NULL UNIQUE, key_version text NOT NULL,
 sku text NOT NULL REFERENCES products ON DELETE RESTRICT,
 device_id uuid NOT NULL REFERENCES devices ON DELETE RESTRICT,
 customer_id uuid NOT NULL, generation integer NOT NULL,
 status text NOT NULL DEFAULT 'ISSUED' CHECK(status IN ('ISSUED','REDEEMED','CANCELLED')),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(customer_id,device_id,generation) REFERENCES customers(id,device_id,generation) ON DELETE RESTRICT
);
CREATE TABLE activation_redemptions (
 device_id uuid NOT NULL REFERENCES devices ON DELETE RESTRICT, generation integer NOT NULL,
 request_id uuid NOT NULL, request_digest text NOT NULL,
 code_id uuid NOT NULL UNIQUE REFERENCES activation_codes ON DELETE RESTRICT,
 signed_license jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(device_id,generation,request_id)
);
CREATE TABLE admins (
 id uuid PRIMARY KEY, username text NOT NULL UNIQUE, password_hash text NOT NULL,
 mfa_ciphertext text NOT NULL, last_mfa_step bigint NOT NULL DEFAULT -1,
 disabled boolean NOT NULL DEFAULT false
);
CREATE TABLE admin_roles (name text PRIMARY KEY);
CREATE TABLE admin_permissions (name text PRIMARY KEY);
CREATE TABLE admin_role_permissions (
 role text REFERENCES admin_roles ON DELETE RESTRICT, permission text REFERENCES admin_permissions ON DELETE RESTRICT,
 PRIMARY KEY(role,permission)
);
CREATE TABLE admin_user_roles (
 admin_id uuid REFERENCES admins ON DELETE RESTRICT, role text REFERENCES admin_roles ON DELETE RESTRICT,
 PRIMARY KEY(admin_id,role)
);
CREATE TABLE admin_sessions (
 token_hash text PRIMARY KEY, admin_id uuid NOT NULL REFERENCES admins ON DELETE RESTRICT,
 csrf_hash text NOT NULL, mfa_at timestamptz NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz
);
CREATE TABLE admin_operations (
 admin_id uuid NOT NULL REFERENCES admins ON DELETE RESTRICT, request_id uuid NOT NULL,
 request_digest text NOT NULL, response jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(admin_id,request_id)
);
CREATE TABLE customer_reset_events (
 id uuid PRIMARY KEY, device_id uuid NOT NULL REFERENCES devices ON DELETE RESTRICT,
 customer_id uuid NOT NULL REFERENCES customers ON DELETE RESTRICT,
 prior_generation integer NOT NULL, next_generation integer NOT NULL,
 reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(next_generation=prior_generation+1), UNIQUE(device_id,next_generation)
);
CREATE TABLE license_recoveries (
 id uuid PRIMARY KEY, license_id uuid NOT NULL REFERENCES licenses ON DELETE RESTRICT,
 decision_version bigint NOT NULL, evidence_ref text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(license_id,decision_version)
);
CREATE TABLE audit_logs (
 id uuid PRIMARY KEY, actor_type text NOT NULL, actor_id uuid, action text NOT NULL,
 entity_id text NOT NULL, correlation_id uuid NOT NULL, metadata_redacted jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_search ON audit_logs(action,created_at DESC);
CREATE INDEX audit_entity ON audit_logs(entity_id,created_at DESC);
CREATE TABLE outbox_events (
 id uuid PRIMARY KEY, type text NOT NULL, aggregate_id text NOT NULL,
 payload_redacted jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz,
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0)
);
CREATE INDEX outbox_pending ON outbox_events(created_at) WHERE processed_at IS NULL;
CREATE TABLE rate_buckets (
 key text NOT NULL, bucket bigint NOT NULL, count integer NOT NULL CHECK(count>0),
 PRIMARY KEY(key,bucket)
);
CREATE FUNCTION immutable_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Immutable history cannot be changed'; END $$;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION immutable_history();
CREATE TRIGGER decisions_immutable BEFORE UPDATE OR DELETE ON license_decisions FOR EACH ROW EXECUTE FUNCTION immutable_history();
CREATE TRIGGER starts_immutable BEFORE UPDATE OR DELETE ON trial_starts FOR EACH ROW EXECUTE FUNCTION immutable_history();
CREATE TRIGGER redemptions_immutable BEFORE UPDATE OR DELETE ON activation_redemptions FOR EACH ROW EXECUTE FUNCTION immutable_history();
CREATE TRIGGER resets_immutable BEFORE UPDATE OR DELETE ON customer_reset_events FOR EACH ROW EXECUTE FUNCTION immutable_history();
CREATE INDEX credentials_expiry ON device_credentials(expires_at);
CREATE INDEX sessions_expiry ON customer_sessions(expires_at);
CREATE INDEX challenges_expiry ON device_challenges(expires_at);
