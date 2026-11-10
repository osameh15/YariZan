-- A switched browser session retains the authority and deadline of its original sign-in.
-- Password reset, mobile reassignment or device reset at that origin invalidates the chain.
ALTER TABLE customer_sessions
 ADD COLUMN auth_customer_id uuid REFERENCES customers(id),
 ADD COLUMN auth_generation integer,
 ADD COLUMN auth_stamp text,
 ADD COLUMN auth_mobile_lookup text,
 ADD CONSTRAINT customer_session_switch_scope CHECK (
   num_nonnulls(auth_customer_id,auth_generation,auth_stamp,auth_mobile_lookup)=0 OR
   (num_nonnulls(auth_customer_id,auth_generation,auth_stamp,auth_mobile_lookup)=4
    AND auth_generation>0 AND auth_stamp ~ '^[A-F0-9]{64}$'
    AND auth_mobile_lookup ~ '^[a-f0-9]{64}$')
 );
CREATE INDEX customer_sessions_auth_customer ON customer_sessions(auth_customer_id) WHERE auth_customer_id IS NOT NULL;
