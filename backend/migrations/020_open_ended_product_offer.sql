-- A documented finite timestamp represents an offer with no scheduled end.
-- Existing dated promotions keep the 366-day limit and all pricing/history guards.
DO $$ DECLARE constraint_name text; BEGIN
 SELECT conname INTO constraint_name FROM pg_constraint
 WHERE conrelid='product_promotions'::regclass AND contype='c'
 AND pg_get_constraintdef(oid) LIKE '%366%';
 IF constraint_name IS NULL THEN RAISE EXCEPTION 'Promotion duration constraint missing'; END IF;
 EXECUTE format('ALTER TABLE product_promotions DROP CONSTRAINT %I',constraint_name);
END $$;
ALTER TABLE product_promotions ADD CONSTRAINT promotion_duration CHECK (
 ends_at<=starts_at+interval '366 days' OR ends_at='9999-12-31T00:00:00Z'::timestamptz
);
