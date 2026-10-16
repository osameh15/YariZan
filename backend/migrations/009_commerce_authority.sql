-- Extend the schema-only commerce foundation. No live gateway or customer data.
ALTER TABLE orders
 ADD COLUMN device_id uuid REFERENCES devices ON DELETE RESTRICT,
 ADD COLUMN generation integer,
 ADD COLUMN sku text REFERENCES products ON DELETE RESTRICT,
 ADD COLUMN request_digest text,
 ADD COLUMN revision bigint NOT NULL DEFAULT 1 CHECK(revision BETWEEN 1 AND 9007199254740991),
 ADD COLUMN paid_at timestamptz,
 ADD COLUMN expires_at timestamptz NOT NULL DEFAULT (now()+interval '15 minutes'),
 ADD COLUMN exception_code text,
 ADD COLUMN accepted_payment_id uuid REFERENCES payment_attempts ON DELETE RESTRICT;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM orders o WHERE (SELECT count(*) FROM order_items i WHERE i.order_id=o.id)<>1) THEN
  RAISE EXCEPTION 'Legacy commerce rows require reviewed single-item backfill';
 END IF;
END $$;
UPDATE orders o SET device_id=c.device_id,generation=c.generation,sku=i.sku,
 request_digest=encode(sha256(convert_to(o.id::text,'UTF8')),'hex')
 FROM customers c,order_items i WHERE c.id=o.customer_id AND i.order_id=o.id;
ALTER TABLE orders ALTER device_id SET NOT NULL, ALTER generation SET NOT NULL,
 ALTER sku SET NOT NULL, ALTER request_digest SET NOT NULL;
ALTER TABLE orders ADD FOREIGN KEY(customer_id,device_id,generation) REFERENCES customers(id,device_id,generation) ON DELETE RESTRICT,
 ADD CHECK(subtotal_irr<=9007199254740991 AND discount_irr<=subtotal_irr AND total_irr<=9007199254740991),
 ADD CHECK(request_digest ~ '^[a-fA-F0-9]{64}$'), ADD UNIQUE(id,sku);
CREATE UNIQUE INDEX order_one_open_purchase ON orders(device_id,generation,sku) WHERE state='PENDING';
CREATE INDEX orders_customer_date ON orders(customer_id,created_at DESC,id);
CREATE INDEX orders_financial_state ON orders(state,created_at,id);
CREATE INDEX orders_id_search ON orders USING gin((id::text) gin_trgm_ops);
ALTER TABLE order_items ADD FOREIGN KEY(order_id,sku) REFERENCES orders(id,sku) ON DELETE RESTRICT,
 ADD CHECK(unit_price_irr<=9007199254740991 AND discount_irr<=unit_price_irr);
CREATE UNIQUE INDEX single_grade_order ON order_items(order_id);
CREATE TRIGGER order_items_preserved BEFORE UPDATE OR DELETE ON order_items FOR EACH ROW EXECUTE FUNCTION immutable_history();
CREATE FUNCTION preserve_order_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' OR (to_jsonb(NEW)-ARRAY['state','revision','paid_at','exception_code','accepted_payment_id']) IS DISTINCT FROM
 (to_jsonb(OLD)-ARRAY['state','revision','paid_at','exception_code','accepted_payment_id']) THEN
 RAISE EXCEPTION 'Order snapshots are immutable'; END IF;
 IF OLD.paid_at IS NOT NULL AND NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN RAISE EXCEPTION 'Paid timestamp is immutable'; END IF;
 IF OLD.accepted_payment_id IS NOT NULL AND NEW.accepted_payment_id IS DISTINCT FROM OLD.accepted_payment_id THEN RAISE EXCEPTION 'Payment allocation is immutable'; END IF;
 IF OLD.state IN ('PAID','FULFILLMENT_PENDING','FULFILLED') AND NEW.state IN ('PENDING','FAILED','CANCELLED') THEN RAISE EXCEPTION 'Captured orders cannot become unpaid'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER order_snapshots BEFORE UPDATE OR DELETE ON orders FOR EACH ROW EXECUTE FUNCTION preserve_order_snapshot();
ALTER TABLE payment_attempts
 ADD COLUMN request_id uuid NOT NULL DEFAULT gen_random_uuid(),
 ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN verified_at timestamptz,
 ADD COLUMN currency text NOT NULL DEFAULT 'IRR' CHECK(currency='IRR'),
 ADD COLUMN provider_config text NOT NULL DEFAULT 'legacy-blocked',
 ADD COLUMN redirect_url text,
 ADD COLUMN reported_ref text,
 ADD COLUMN exception_code text,
 ADD CHECK(amount_irr BETWEEN 1 AND 9007199254740991),
 ADD UNIQUE(order_id,request_id), ADD UNIQUE(id,order_id);
CREATE UNIQUE INDEX payment_one_unresolved ON payment_attempts(order_id) WHERE state IN ('CREATED','PENDING','UNKNOWN');
ALTER TABLE orders ADD CONSTRAINT accepted_payment_scope FOREIGN KEY(accepted_payment_id,id) REFERENCES payment_attempts(id,order_id) ON DELETE RESTRICT;
CREATE FUNCTION preserve_payment_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (NEW.order_id,NEW.provider,NEW.amount_irr,NEW.currency,NEW.request_id,NEW.provider_config,NEW.created_at) IS DISTINCT FROM
 (OLD.order_id,OLD.provider,OLD.amount_irr,OLD.currency,OLD.request_id,OLD.provider_config,OLD.created_at)
 OR (OLD.authority IS NOT NULL AND NEW.authority IS DISTINCT FROM OLD.authority)
 OR (OLD.provider_ref IS NOT NULL AND NEW.provider_ref IS DISTINCT FROM OLD.provider_ref)
 OR (OLD.reported_ref IS NOT NULL AND NEW.reported_ref IS DISTINCT FROM OLD.reported_ref)
 OR (OLD.verified_at IS NOT NULL AND NEW.verified_at IS DISTINCT FROM OLD.verified_at)
 OR (OLD.state='VERIFIED' AND NEW.state<>'VERIFIED') THEN RAISE EXCEPTION 'Payment evidence cannot be rewritten'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER payment_snapshots BEFORE UPDATE ON payment_attempts FOR EACH ROW EXECUTE FUNCTION preserve_payment_snapshot();
CREATE INDEX payment_order_date ON payment_attempts(order_id,created_at,id);
CREATE TABLE payment_transitions (
 id uuid PRIMARY KEY, attempt_id uuid NOT NULL REFERENCES payment_attempts ON DELETE RESTRICT,
 prior_state text, next_state text NOT NULL, reason text NOT NULL,
 correlation_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER transitions_preserved BEFORE UPDATE OR DELETE ON payment_transitions FOR EACH ROW EXECUTE FUNCTION immutable_history();
ALTER TABLE discount_campaigns ADD COLUMN revision bigint NOT NULL DEFAULT 1 CHECK(revision BETWEEN 1 AND 9007199254740991);
ALTER TABLE discount_codes ADD COLUMN revision bigint NOT NULL DEFAULT 1 CHECK(revision BETWEEN 1 AND 9007199254740991),
 ADD COLUMN max_redemptions integer CHECK(max_redemptions>0), ADD COLUMN max_per_customer integer CHECK(max_per_customer>0),
 ADD CHECK(value<=9007199254740991 AND (max_discount_irr IS NULL OR max_discount_irr<=9007199254740991) AND (min_order_irr IS NULL OR min_order_irr<=9007199254740991));
ALTER TABLE discount_reservations ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE discount_redemptions ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX reservations_quota ON discount_reservations(code_id,customer_id,state);
CREATE INDEX redemptions_quota ON discount_redemptions(code_id,customer_id);
CREATE TRIGGER discount_history BEFORE UPDATE OR DELETE ON discount_redemptions FOR EACH ROW EXECUTE FUNCTION immutable_history();
CREATE TABLE commerce_jobs (
 id uuid PRIMARY KEY, kind text NOT NULL CHECK(kind IN ('VERIFY','FULFILL','PURCHASE_NOTICE','EXPIRE')),
 target_id uuid NOT NULL, order_id uuid NOT NULL REFERENCES orders ON DELETE RESTRICT,
 state text NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','RUNNING','DONE','REVIEW')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0), due_at timestamptz NOT NULL DEFAULT now(),
 lease_until timestamptz, lease_token uuid, last_error text, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(kind,target_id)
);
CREATE INDEX commerce_jobs_due ON commerce_jobs(due_at,id) WHERE state IN ('PENDING','RUNNING');
CREATE TABLE order_fulfillments (
 order_item_id uuid PRIMARY KEY REFERENCES order_items ON DELETE RESTRICT,
 entitlement_id uuid NOT NULL UNIQUE REFERENCES entitlements ON DELETE RESTRICT,
 license_id uuid NOT NULL UNIQUE REFERENCES licenses ON DELETE RESTRICT,
 fulfilled_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER fulfillment_history BEFORE UPDATE OR DELETE ON order_fulfillments FOR EACH ROW EXECUTE FUNCTION immutable_history();
CREATE TABLE commerce_exceptions (
 id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES orders ON DELETE RESTRICT,
 attempt_id uuid REFERENCES payment_attempts ON DELETE RESTRICT, code text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(order_id,attempt_id,code)
);
CREATE TRIGGER exception_history BEFORE UPDATE OR DELETE ON commerce_exceptions FOR EACH ROW EXECUTE FUNCTION immutable_history();
CREATE TABLE purchase_notifications (
 order_id uuid PRIMARY KEY REFERENCES orders ON DELETE RESTRICT,
 template_key text NOT NULL, state text NOT NULL CHECK(state IN ('RECORDED','SYNTHETIC_DELIVERED')),
 created_at timestamptz NOT NULL DEFAULT now()
);
-- Durable fake provider ledger is only selected by explicit local/test fake mode.
CREATE TABLE fake_gateway_payments (
 attempt_id uuid PRIMARY KEY REFERENCES payment_attempts ON DELETE RESTRICT,
 authority text NOT NULL UNIQUE, provider_ref text NOT NULL,
 amount_irr bigint NOT NULL CHECK(amount_irr>0), currency text NOT NULL CHECK(currency='IRR'),
 merchant_config text NOT NULL, outcome text NOT NULL DEFAULT 'PENDING' CHECK(outcome IN ('PENDING','SUCCESS','FAILED','CANCELLED','UNKNOWN')),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE refund_requests ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN revision bigint NOT NULL DEFAULT 1, ADD COLUMN reviewed_by uuid REFERENCES admins ON DELETE RESTRICT,
 ADD COLUMN review_reason text;
CREATE UNIQUE INDEX refund_one_request ON refund_requests(order_id);
ALTER TABLE entity_notes DROP CONSTRAINT entity_notes_entity_type_check;
ALTER TABLE entity_notes ADD CHECK(entity_type IN ('customers','devices','licenses','activation-codes','trials','products','orders','payments','campaigns','coupons')),
 ADD COLUMN order_id uuid GENERATED ALWAYS AS (CASE WHEN entity_type='orders' THEN entity_id::uuid END) STORED REFERENCES orders ON DELETE RESTRICT,
 ADD COLUMN payment_id uuid GENERATED ALWAYS AS (CASE WHEN entity_type='payments' THEN entity_id::uuid END) STORED REFERENCES payment_attempts ON DELETE RESTRICT,
 ADD COLUMN campaign_id uuid GENERATED ALWAYS AS (CASE WHEN entity_type='campaigns' THEN entity_id::uuid END) STORED REFERENCES discount_campaigns ON DELETE RESTRICT,
 ADD COLUMN coupon_id uuid GENERATED ALWAYS AS (CASE WHEN entity_type='coupons' THEN entity_id::uuid END) STORED REFERENCES discount_codes ON DELETE RESTRICT;
INSERT INTO admin_roles(name) VALUES('owner'),('catalog'),('auditor'),('support') ON CONFLICT DO NOTHING;
INSERT INTO admin_permissions(name) VALUES('commerce.read'),('commerce.manage'),('finance.read'),('finance.reconcile'),('refunds.review') ON CONFLICT DO NOTHING;
INSERT INTO admin_role_permissions(role,permission) SELECT 'owner',name FROM admin_permissions WHERE name LIKE 'commerce.%' OR name LIKE 'finance.%' OR name='refunds.review' ON CONFLICT DO NOTHING;
INSERT INTO admin_role_permissions(role,permission) VALUES('auditor','finance.read'),('auditor','commerce.read'),('support','commerce.read'),('catalog','commerce.read'),('catalog','commerce.manage') ON CONFLICT DO NOTHING;

ALTER TABLE entitlements ADD UNIQUE(source_order_item_id,id);
ALTER TABLE licenses ADD UNIQUE(id,entitlement_id);
ALTER TABLE order_fulfillments ADD FOREIGN KEY(order_item_id,entitlement_id) REFERENCES entitlements(source_order_item_id,id) ON DELETE RESTRICT,
 ADD FOREIGN KEY(license_id,entitlement_id) REFERENCES licenses(id,entitlement_id) ON DELETE RESTRICT;

ALTER TABLE orders ADD UNIQUE(id,total_irr,currency);
ALTER TABLE payment_attempts ADD FOREIGN KEY(order_id,amount_irr,currency) REFERENCES orders(id,total_irr,currency) ON DELETE RESTRICT;
ALTER TABLE commerce_jobs ADD COLUMN payment_id uuid GENERATED ALWAYS AS (CASE WHEN kind='VERIFY' THEN target_id END) STORED,
 ADD FOREIGN KEY(payment_id,order_id) REFERENCES payment_attempts(id,order_id) ON DELETE RESTRICT,
 ADD CHECK(kind='VERIFY' OR target_id=order_id);
ALTER TABLE commerce_exceptions ADD FOREIGN KEY(attempt_id,order_id) REFERENCES payment_attempts(id,order_id) ON DELETE RESTRICT;
ALTER TABLE entitlements ADD CHECK((source_type='PURCHASE')=(source_order_item_id IS NOT NULL));
CREATE FUNCTION purchase_entitlement_scope() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.source_type='PURCHASE' AND NOT EXISTS(SELECT 1 FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.id=NEW.source_order_item_id AND o.paid_at IS NOT NULL AND o.accepted_payment_id IS NOT NULL AND (o.customer_id,o.device_id,o.generation,o.sku)=(NEW.customer_id,NEW.device_id,NEW.generation,NEW.sku)) THEN RAISE EXCEPTION 'Purchase requires captured order scope'; END IF; RETURN NEW; END $$;
CREATE TRIGGER purchase_scope BEFORE INSERT OR UPDATE ON entitlements FOR EACH ROW EXECUTE FUNCTION purchase_entitlement_scope();
ALTER TABLE discount_campaigns ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE discount_codes ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE commerce_job_runs (
 id uuid PRIMARY KEY, job_id uuid NOT NULL REFERENCES commerce_jobs ON DELETE RESTRICT,
 attempt integer NOT NULL CHECK(attempt>0), event text NOT NULL CHECK(event IN ('STARTED','DONE','RETRY','REVIEW')),
 error text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(job_id,attempt,event)
);
CREATE TRIGGER job_runs_history BEFORE UPDATE OR DELETE ON commerce_job_runs FOR EACH ROW EXECUTE FUNCTION immutable_history();
CREATE INDEX commerce_job_history ON commerce_job_runs(job_id,attempt,created_at);
