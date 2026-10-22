-- Payment reconciliation evidence. Two separate, never-merged facts per attempt:
--   * what the customer's browser reported on return (ZarinPal `Status=OK|NOK`): untrusted, display only;
--   * what the provider's inquiry method answered (VERIFIED, PAID, IN_BANK, FAILED, REVERSED): an
--     observation, never a verification. Every observation is kept in an append-only history.
-- Neither one is settlement evidence. Capture still needs a verify answer (100, or 101 with order-bound
-- evidence); an attempt becomes terminal FAILED only after repeated, spaced provider FAILED answers.
ALTER TABLE payment_attempts
 ADD COLUMN customer_return text CHECK(customer_return IN ('OK','NOK')),
 ADD COLUMN customer_return_at timestamptz,
 ADD COLUMN provider_status text CHECK(provider_status IN ('VERIFIED','PAID','IN_BANK','FAILED','REVERSED')),
 ADD COLUMN provider_status_at timestamptz,
 ADD CONSTRAINT payment_customer_return_time CHECK((customer_return IS NULL)=(customer_return_at IS NULL)),
 ADD CONSTRAINT payment_provider_status_time CHECK((provider_status IS NULL)=(provider_status_at IS NULL));
CREATE TABLE payment_inquiries (
 id uuid PRIMARY KEY, attempt_id uuid NOT NULL REFERENCES payment_attempts ON DELETE RESTRICT,
 status text NOT NULL CHECK(status IN ('VERIFIED','PAID','IN_BANK','FAILED','REVERSED')),
 correlation_id uuid NOT NULL, observed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER inquiries_immutable BEFORE UPDATE OR DELETE ON payment_inquiries FOR EACH ROW EXECUTE FUNCTION immutable_history();
CREATE INDEX payment_inquiry_history ON payment_inquiries(attempt_id,observed_at);
