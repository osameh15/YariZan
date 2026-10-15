-- Preserve nonce uniqueness across allocations: a retired request must never spend a new entry.
ALTER TABLE trial_counters ADD COLUMN allocation_epoch bigint NOT NULL DEFAULT 1
 CHECK (allocation_epoch BETWEEN 1 AND 9007199254740991);
ALTER TABLE trial_starts ADD COLUMN allocation_epoch bigint NOT NULL DEFAULT 1
 CHECK (allocation_epoch BETWEEN 1 AND 9007199254740991);
CREATE INDEX trial_starts_allocation ON trial_starts(device_id,sku,generation,allocation_epoch);
