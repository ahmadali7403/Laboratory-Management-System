-- CreateIndex
CREATE INDEX IF NOT EXISTS "Patient_organizationId_name_idx" ON "Patient"("organizationId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Patient_organizationId_phone_idx" ON "Patient"("organizationId", "phone");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LabOrder_organizationId_createdAt_idx" ON "LabOrder"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_organizationId_createdAt_idx" ON "Payment"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Medicine_organizationId_branchId_genericName_idx" ON "Medicine"("organizationId", "branchId", "genericName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Medicine_organizationId_branchId_sku_idx" ON "Medicine"("organizationId", "branchId", "sku");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Medicine_organizationId_branchId_updatedAt_idx" ON "Medicine"("organizationId", "branchId", "updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MedicineBatch_organizationId_branchId_batchNumber_idx" ON "MedicineBatch"("organizationId", "branchId", "batchNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PharmacySale_organizationId_createdAt_idx" ON "PharmacySale"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PharmacySale_organizationId_branchId_soldByName_idx" ON "PharmacySale"("organizationId", "branchId", "soldByName");
