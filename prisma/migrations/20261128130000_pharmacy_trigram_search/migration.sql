-- Enable pg_trgm for fast substring & prefix matching on pharmacy medicine/batch search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Medicine_name_trgm_idx" ON "Medicine" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Medicine_genericName_trgm_idx" ON "Medicine" USING gin ("genericName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Medicine_barcode_trgm_idx" ON "Medicine" USING gin ("barcode" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Medicine_sku_trgm_idx" ON "Medicine" USING gin ("sku" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "MedicineBatch_batchNumber_trgm_idx" ON "MedicineBatch" USING gin ("batchNumber" gin_trgm_ops);
