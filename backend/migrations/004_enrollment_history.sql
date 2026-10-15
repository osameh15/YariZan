CREATE TABLE device_enrollment_history (
 id uuid PRIMARY KEY, key_id uuid NOT NULL REFERENCES device_keys ON DELETE RESTRICT,
 customer_id uuid NOT NULL REFERENCES customers ON DELETE RESTRICT,
 generation integer NOT NULL CHECK(generation>0), signed_enrollment jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(key_id,generation)
);
CREATE TRIGGER enrollment_history_immutable BEFORE UPDATE OR DELETE ON device_enrollment_history FOR EACH ROW EXECUTE FUNCTION immutable_history();
CREATE TABLE license_replacements (
 id uuid PRIMARY KEY, old_license_id uuid NOT NULL REFERENCES licenses ON DELETE RESTRICT,
 new_license_id uuid UNIQUE REFERENCES licenses ON DELETE RESTRICT,
 lifecycle_revision bigint NOT NULL CHECK(lifecycle_revision BETWEEN 1 AND 9007199254740991),
 state text NOT NULL CHECK(state IN ('PROTOCOL_BLOCKED','REVIEWED','COMMITTED')),
 evidence_ref text NOT NULL, signed_authorization jsonb,
 CHECK(old_license_id<>new_license_id),
 CHECK(state='PROTOCOL_BLOCKED' OR (new_license_id IS NOT NULL AND signed_authorization IS NOT NULL)),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(old_license_id,lifecycle_revision)
);
CREATE TRIGGER replacements_preserved BEFORE DELETE ON license_replacements FOR EACH ROW EXECUTE FUNCTION immutable_history();
