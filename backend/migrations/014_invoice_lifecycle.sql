-- Invoice lifecycle (release 2.1.0). An unpaid invoice now ends as soon as the payment is cancelled or
-- fails, or when its 15-minute window passes, so the customer can issue a new invoice and pay again.
-- An ended attempt is never verified later: the bank returns unverified money to the payer on its own.
-- The reason an invoice ended, and whether an Admin archived it, are kept on the order. Nothing financial
-- is ever deleted: archived orders and devices are only hidden from the default lists.
ALTER TABLE orders
 ADD COLUMN closed_reason text CHECK(closed_reason IN ('customer_cancelled','payment_unsuccessful','invoice_expired','admin_voided','provider_confirmed_failed')),
 ADD COLUMN closed_at timestamptz,
 ADD COLUMN archived_at timestamptz,
 ADD CONSTRAINT order_closed_complete CHECK((closed_reason IS NULL)=(closed_at IS NULL)),
 ADD CONSTRAINT order_closed_state CHECK(closed_reason IS NULL OR state IN ('FAILED','CANCELLED')),
 ADD CONSTRAINT order_archive_unpaid CHECK(archived_at IS NULL OR (state IN ('FAILED','CANCELLED') AND accepted_payment_id IS NULL));
CREATE INDEX orders_customer_visible ON orders(customer_id,created_at DESC) WHERE archived_at IS NULL;

-- The snapshot stays immutable. Besides the existing settlement fields, only the lifecycle fields may
-- change, and the invoice window may be renewed only when an Admin sends an ended, unpaid invoice back
-- to payment.
CREATE OR REPLACE FUNCTION preserve_order_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' OR (to_jsonb(NEW)-ARRAY['state','revision','paid_at','exception_code','accepted_payment_id','closed_reason','closed_at','archived_at','expires_at']) IS DISTINCT FROM
 (to_jsonb(OLD)-ARRAY['state','revision','paid_at','exception_code','accepted_payment_id','closed_reason','closed_at','archived_at','expires_at']) THEN
 RAISE EXCEPTION 'Order snapshots are immutable'; END IF;
 IF NEW.expires_at IS DISTINCT FROM OLD.expires_at AND NOT (OLD.state IN ('FAILED','CANCELLED') AND NEW.state='PENDING' AND OLD.accepted_payment_id IS NULL AND NEW.expires_at>now()) THEN
 RAISE EXCEPTION 'Order snapshots are immutable: the invoice window is renewed only when an ended invoice returns to payment'; END IF;
 IF OLD.paid_at IS NOT NULL AND NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN RAISE EXCEPTION 'Paid timestamp is immutable'; END IF;
 IF OLD.accepted_payment_id IS NOT NULL AND NEW.accepted_payment_id IS DISTINCT FROM OLD.accepted_payment_id THEN RAISE EXCEPTION 'Payment allocation is immutable'; END IF;
 IF OLD.state IN ('PAID','FULFILLMENT_PENDING','FULFILLED') AND NEW.state IN ('PENDING','FAILED','CANCELLED') THEN RAISE EXCEPTION 'Captured orders cannot become unpaid'; END IF;
 RETURN NEW; END $$;

-- Test and unused devices: an Admin hides them from the default lists. A device with no history at all
-- may be deleted outright (runtime DELETE grant on devices only; every reference stays ON DELETE RESTRICT).
ALTER TABLE devices ADD COLUMN archived_at timestamptz;
INSERT INTO admin_permissions(name) VALUES('devices.manage') ON CONFLICT DO NOTHING;
INSERT INTO admin_role_permissions(role,permission) VALUES('owner','devices.manage') ON CONFLICT DO NOTHING;
