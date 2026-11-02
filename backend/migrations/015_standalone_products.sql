-- Independent games use grade 0 and a separate SKU namespace. Existing grade identities,
-- device bindings, trial counters and append-only purchase history are preserved.
ALTER TABLE products DROP CONSTRAINT products_sku_check;
ALTER TABLE products DROP CONSTRAINT products_grade_check;
ALTER TABLE products DROP CONSTRAINT products_check;
ALTER TABLE products DROP CONSTRAINT products_grade_key;
ALTER TABLE products ADD CONSTRAINT products_identity_check CHECK (
 (grade BETWEEN 1 AND 6 AND sku='YARIZAN-G'||grade) OR
 (grade=0 AND sku ~ '^YARIZAN-S-[A-Z0-9]+(-[A-Z0-9]+)*$' AND length(sku)<=80)
);
CREATE UNIQUE INDEX products_grade_identity ON products(grade) WHERE grade>0;
