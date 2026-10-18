-- Price provenance (every branch is NULL-safe: a NULL CHECK result would otherwise pass). Every price row records who authorized it: an Admin (changed_by), or the
-- reviewed production bootstrap under a named pricing revision. No fabricated Admin identity.
ALTER TABLE product_prices ADD COLUMN source text, ADD COLUMN pricing_revision text;
-- Rows written before this migration without an Admin (development/test seeds) stay visible as such.
UPDATE product_prices SET source=CASE WHEN changed_by IS NULL THEN 'UNATTRIBUTED' ELSE 'ADMIN' END;
ALTER TABLE product_prices ALTER COLUMN source SET NOT NULL,
 ADD CONSTRAINT price_provenance CHECK(
  (source='ADMIN' AND changed_by IS NOT NULL AND pricing_revision IS NULL) OR
  (source='BOOTSTRAP' AND changed_by IS NULL AND pricing_revision IS NOT NULL AND pricing_revision ~ '^pricing-[0-9]{4}-[0-9]{2}-[0-9]{2}-r[0-9]+$') OR
  (source='UNATTRIBUTED' AND changed_by IS NULL AND pricing_revision IS NULL));
-- Price history is append-only: a row may only be closed once (ended_at NULL -> timestamp).
CREATE FUNCTION price_history_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF OLD.ended_at IS NOT NULL OR NEW.ended_at IS NULL OR
  (to_jsonb(NEW)-'ended_at') IS DISTINCT FROM (to_jsonb(OLD)-'ended_at') THEN
  RAISE EXCEPTION 'Price history is append-only';
 END IF; RETURN NEW; END $$;
CREATE TRIGGER prices_append_only BEFORE UPDATE ON product_prices FOR EACH ROW EXECUTE FUNCTION price_history_append_only();
