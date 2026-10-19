-- Admin enrollment state. Existing Admins stay ACTIVE. A PENDING Admin is created by the reviewed operator
-- procedure, is always disabled, holds no role and cannot authenticate until its own phone passes SMS MFA.
ALTER TABLE admins
 ADD COLUMN enrollment_state text NOT NULL DEFAULT 'ACTIVE' CHECK(enrollment_state IN ('PENDING','ACTIVE')),
 ADD COLUMN mobile_lookup text CHECK(mobile_lookup IS NULL OR mobile_lookup ~ '^[a-f0-9]{64}$'),
 ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN enrolled_at timestamptz;
-- A pending Admin must be disabled and must carry the encrypted phone that will receive its MFA code.
ALTER TABLE admins ADD CONSTRAINT admin_pending_is_disabled CHECK(
 enrollment_state='ACTIVE' OR (disabled AND mobile_ciphertext IS NOT NULL AND mobile_lookup IS NOT NULL AND enrolled_at IS NULL));
-- One phone can belong to at most one Admin.
CREATE UNIQUE INDEX admins_mobile_lookup_unique ON admins(mobile_lookup) WHERE mobile_lookup IS NOT NULL;
-- Enrollment is one-way, and a pending Admin can never hold a role.
CREATE FUNCTION admin_enrollment_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF OLD.enrollment_state='ACTIVE' AND NEW.enrollment_state='PENDING' THEN
  RAISE EXCEPTION 'An enrolled Admin cannot return to pending';
 END IF; RETURN NEW; END $$;
CREATE TRIGGER admins_enrollment_guard BEFORE UPDATE ON admins FOR EACH ROW EXECUTE FUNCTION admin_enrollment_guard();
CREATE FUNCTION admin_role_requires_enrollment() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (SELECT enrollment_state FROM admins WHERE id=NEW.admin_id)<>'ACTIVE' THEN
  RAISE EXCEPTION 'A pending Admin cannot hold a role';
 END IF; RETURN NEW; END $$;
CREATE TRIGGER admin_roles_enrollment_guard BEFORE INSERT ON admin_user_roles FOR EACH ROW EXECUTE FUNCTION admin_role_requires_enrollment();
