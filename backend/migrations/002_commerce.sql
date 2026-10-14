-- Schema only. No checkout, payment, discount settlement or refund handlers.
CREATE TABLE product_prices (
 id uuid PRIMARY KEY, sku text NOT NULL REFERENCES products ON DELETE RESTRICT,
 amount_irr bigint NOT NULL CHECK(amount_irr BETWEEN 0 AND 9007199254740991),
 effective_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz,
 changed_by uuid REFERENCES admins ON DELETE RESTRICT,
 CHECK(ended_at IS NULL OR ended_at>=effective_at)
);
CREATE UNIQUE INDEX product_price_current ON product_prices(sku) WHERE ended_at IS NULL;
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE product_prices ADD CONSTRAINT price_no_overlap EXCLUDE USING gist
 (sku WITH =, tstzrange(effective_at,ended_at,'[)') WITH &&);
CREATE TABLE product_releases (
 id uuid PRIMARY KEY, sku text NOT NULL REFERENCES products ON DELETE RESTRICT,
 version text NOT NULL, installer_url text NOT NULL, sha256 text NOT NULL CHECK(sha256 ~ '^[A-F0-9]{64}$'),
 size_bytes bigint NOT NULL CHECK(size_bytes>0), UNIQUE(sku,version)
);
CREATE TABLE orders (
 id uuid PRIMARY KEY, customer_id uuid NOT NULL REFERENCES customers ON DELETE RESTRICT,
 request_id uuid NOT NULL, currency text NOT NULL DEFAULT 'IRR' CHECK(currency='IRR'),
 subtotal_irr bigint NOT NULL CHECK(subtotal_irr>=0), discount_irr bigint NOT NULL CHECK(discount_irr>=0),
 total_irr bigint NOT NULL CHECK(total_irr>=0), state text NOT NULL CHECK(state IN ('PENDING','PAID','FULFILLMENT_PENDING','FULFILLED','FAILED','CANCELLED','REFUNDED')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(customer_id,request_id), CHECK(total_irr=subtotal_irr-discount_irr)
);
CREATE TABLE order_items (
 id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES orders ON DELETE RESTRICT,
 sku text NOT NULL REFERENCES products ON DELETE RESTRICT, quantity integer NOT NULL CHECK(quantity=1),
 unit_price_irr bigint NOT NULL CHECK(unit_price_irr>=0), discount_irr bigint NOT NULL CHECK(discount_irr>=0),
 total_irr bigint NOT NULL CHECK(total_irr=unit_price_irr-discount_irr AND total_irr>=0), snapshot jsonb NOT NULL,
 UNIQUE(order_id,sku)
);
ALTER TABLE entitlements ADD COLUMN source_order_item_id uuid UNIQUE REFERENCES order_items ON DELETE RESTRICT;
CREATE TABLE payment_attempts (
 id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES orders ON DELETE RESTRICT,
 provider text NOT NULL CHECK(provider='zarinpal'), authority text, provider_ref text,
 amount_irr bigint NOT NULL CHECK(amount_irr>=0), state text NOT NULL CHECK(state IN ('CREATED','PENDING','UNKNOWN','VERIFIED','FAILED','CANCELLED','REFUNDED'))
);
CREATE UNIQUE INDEX payment_authority ON payment_attempts(provider,authority) WHERE authority IS NOT NULL;
CREATE UNIQUE INDEX payment_reference ON payment_attempts(provider,provider_ref) WHERE provider_ref IS NOT NULL;
CREATE TABLE payment_events (
 id uuid PRIMARY KEY, payment_attempt_id uuid REFERENCES payment_attempts ON DELETE RESTRICT,
 provider text NOT NULL, external_event_id text, payload_digest text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payment_event_dedupe ON payment_events(provider,external_event_id) WHERE external_event_id IS NOT NULL;
CREATE TABLE discount_campaigns (
 id uuid PRIMARY KEY, name text NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 enabled boolean NOT NULL DEFAULT false, max_redemptions integer CHECK(max_redemptions>0),
 max_per_customer integer CHECK(max_per_customer>0), CHECK(ends_at>starts_at)
);
CREATE TABLE discount_codes (
 id uuid PRIMARY KEY, campaign_id uuid NOT NULL REFERENCES discount_campaigns ON DELETE RESTRICT,
 code text NOT NULL UNIQUE CHECK(code ~ '^[A-Z0-9_-]{1,64}$'),
 type text NOT NULL CHECK(type IN ('percent','fixed')), value bigint NOT NULL CHECK(value>0),
 max_discount_irr bigint CHECK(max_discount_irr>=0), min_order_irr bigint CHECK(min_order_irr>=0),
 enabled boolean NOT NULL DEFAULT false, CHECK(type<>'percent' OR value<=100)
);
CREATE TABLE discount_products (
 code_id uuid REFERENCES discount_codes ON DELETE RESTRICT, sku text REFERENCES products ON DELETE RESTRICT,
 PRIMARY KEY(code_id,sku)
);
CREATE TABLE discount_reservations (
 id uuid PRIMARY KEY, code_id uuid NOT NULL REFERENCES discount_codes ON DELETE RESTRICT,
 order_id uuid NOT NULL UNIQUE REFERENCES orders ON DELETE RESTRICT,
 customer_id uuid NOT NULL REFERENCES customers ON DELETE RESTRICT,
 expires_at timestamptz NOT NULL, state text NOT NULL CHECK(state IN ('RESERVED','REDEEMED','RELEASED','UNKNOWN'))
);
CREATE TABLE discount_redemptions (
 id uuid PRIMARY KEY, code_id uuid NOT NULL REFERENCES discount_codes ON DELETE RESTRICT,
 order_id uuid NOT NULL UNIQUE REFERENCES orders ON DELETE RESTRICT,
 customer_id uuid NOT NULL REFERENCES customers ON DELETE RESTRICT
);
CREATE TABLE refund_requests (
 id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES orders ON DELETE RESTRICT,
 customer_id uuid NOT NULL REFERENCES customers ON DELETE RESTRICT, reason text NOT NULL,
 state text NOT NULL CHECK(state IN ('REQUESTED','UNDER_REVIEW','APPROVED','REJECTED','PROCESSING','REFUNDED','FAILED'))
);
CREATE TABLE refunds (
 id uuid PRIMARY KEY, request_id uuid NOT NULL REFERENCES refund_requests ON DELETE RESTRICT,
 payment_attempt_id uuid NOT NULL REFERENCES payment_attempts ON DELETE RESTRICT,
 amount_irr bigint NOT NULL CHECK(amount_irr>0), provider_ref text UNIQUE,
 state text NOT NULL CHECK(state IN ('PENDING','UNKNOWN','CONFIRMED','FAILED'))
);
CREATE TRIGGER payments_immutable BEFORE DELETE ON payment_attempts FOR EACH ROW EXECUTE FUNCTION immutable_history();
CREATE TRIGGER payment_events_immutable BEFORE UPDATE OR DELETE ON payment_events FOR EACH ROW EXECUTE FUNCTION immutable_history();
CREATE TRIGGER prices_preserved BEFORE DELETE ON product_prices FOR EACH ROW EXECUTE FUNCTION immutable_history();
