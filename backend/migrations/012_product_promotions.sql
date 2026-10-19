-- Per-product promotional pricing. A promotion never replaces the immutable list price: it is a separate,
-- audited record that is priced against one specific base price row and applies only while that exact
-- price is still current. Activation and expiry are decided by database time at read, so an expired
-- promotion stops affecting new quotes without any manual action.
CREATE TABLE product_promotions (
 id uuid PRIMARY KEY,
 sku text NOT NULL REFERENCES products ON DELETE RESTRICT,
 base_price_id uuid NOT NULL REFERENCES product_prices ON DELETE RESTRICT,
 original_price_irr bigint NOT NULL CHECK(original_price_irr BETWEEN 10000 AND 9007199254740991),
 promo_price_irr bigint NOT NULL CHECK(promo_price_irr BETWEEN 10000 AND 9007199254740991),
 -- Whole-percent discount, always derived by the database from the two integer prices.
 discount_percent integer GENERATED ALWAYS AS (((original_price_irr-promo_price_irr)*100/original_price_irr)::integer) STORED,
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 state text NOT NULL CHECK(state IN ('ENABLED','DISABLED')),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision BETWEEN 1 AND 9007199254740991),
 reason text NOT NULL CHECK(length(reason) BETWEEN 8 AND 512),
 created_by uuid NOT NULL REFERENCES admins ON DELETE RESTRICT, updated_by uuid NOT NULL REFERENCES admins ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(promo_price_irr<original_price_irr), CHECK(ends_at>starts_at),
 CHECK(ends_at<=starts_at+interval '366 days'),
 -- At most one enabled promotion can cover any instant of a product.
 CONSTRAINT promotion_no_overlap EXCLUDE USING gist (sku WITH =, tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE (state='ENABLED')
);
CREATE INDEX promotions_sku_window ON product_promotions(sku,starts_at,ends_at) WHERE state='ENABLED';
CREATE TRIGGER promotions_preserved BEFORE DELETE ON product_promotions FOR EACH ROW EXECUTE FUNCTION immutable_history();
-- The identity of a promotion's economics cannot change: price, base price and product are fixed at creation
-- (a different price needs a new promotion). Only the window of a not-yet-started promotion and its state move.
CREATE FUNCTION promotion_economics_fixed() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.sku<>OLD.sku OR NEW.base_price_id<>OLD.base_price_id OR NEW.original_price_irr<>OLD.original_price_irr
  OR NEW.created_by<>OLD.created_by OR NEW.created_at<>OLD.created_at
  OR (NEW.promo_price_irr<>OLD.promo_price_irr AND OLD.starts_at<=clock_timestamp() AND OLD.ends_at>clock_timestamp() AND OLD.state='ENABLED') THEN
  RAISE EXCEPTION 'Promotion economics are fixed once created and while active';
 END IF; RETURN NEW; END $$;
CREATE TRIGGER promotions_economics_fixed BEFORE UPDATE ON product_promotions FOR EACH ROW EXECUTE FUNCTION promotion_economics_fixed();
CREATE TABLE product_promotion_events (
 id uuid PRIMARY KEY, promotion_id uuid NOT NULL REFERENCES product_promotions ON DELETE RESTRICT,
 revision bigint NOT NULL, action text NOT NULL CHECK(action IN ('CREATED','UPDATED','DEACTIVATED','RESTORED')),
 snapshot jsonb NOT NULL, reason text NOT NULL, admin_id uuid NOT NULL REFERENCES admins ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(promotion_id,revision)
);
CREATE TRIGGER promotion_events_immutable BEFORE UPDATE OR DELETE ON product_promotion_events FOR EACH ROW EXECUTE FUNCTION immutable_history();

-- Orders record the promotion that priced them. subtotal is the list price, discount is the promotion
-- discount and total is the promotional price, so the existing money invariants keep holding.
ALTER TABLE orders
 ADD COLUMN promotion_id uuid REFERENCES product_promotions ON DELETE RESTRICT,
 ADD COLUMN promotion_discount_irr bigint NOT NULL DEFAULT 0 CHECK(promotion_discount_irr>=0),
 ADD CONSTRAINT order_promotion_consistent CHECK((promotion_id IS NULL AND promotion_discount_irr=0) OR (promotion_id IS NOT NULL AND promotion_discount_irr>0)),
 ADD CONSTRAINT order_promotion_never_stacks_with_coupon CHECK(promotion_id IS NULL OR discount_irr=promotion_discount_irr);
-- A coupon reservation or redemption can never attach to an order that was priced by a promotion.
CREATE FUNCTION coupon_never_on_promoted_order() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM orders WHERE id=NEW.order_id AND promotion_id IS NOT NULL) THEN
  RAISE EXCEPTION 'A promotional price cannot be combined with a coupon';
 END IF; RETURN NEW; END $$;
CREATE TRIGGER reservations_not_on_promotion BEFORE INSERT ON discount_reservations FOR EACH ROW EXECUTE FUNCTION coupon_never_on_promoted_order();
CREATE TRIGGER redemptions_not_on_promotion BEFORE INSERT ON discount_redemptions FOR EACH ROW EXECUTE FUNCTION coupon_never_on_promoted_order();
