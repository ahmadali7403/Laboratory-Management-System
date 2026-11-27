-- CreateEnum
CREATE TYPE "MedicineStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "PharmacyPurchaseStatus" AS ENUM ('DRAFT', 'ORDERED', 'FINALIZED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PharmacySaleStatus" AS ENUM ('COMPLETED', 'PARTIAL_RETURN', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PharmacyStockMovementType" AS ENUM ('INITIAL_STOCK', 'PURCHASE_IN', 'SALE_OUT', 'ADJUSTMENT_ADD', 'ADJUSTMENT_SUB', 'PURCHASE_RETURN_OUT', 'SALE_RETURN_IN', 'SALE_CANCEL_RESTORE');

-- CreateEnum
CREATE TYPE "PharmacyAdjustmentType" AS ENUM ('INCREASE', 'DECREASE', 'DAMAGED', 'EXPIRED_WRITE_OFF', 'CORRECTION');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'JAZZCASH';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'EASYPAISA';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "pharmacySaleId" UUID,
ALTER COLUMN "orderId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "pharmacyBalance" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "MedicineCategory" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "branchId" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicineCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicineCompany" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "branchId" UUID,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicineCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medicine" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "genericName" TEXT,
    "categoryId" UUID,
    "companyId" UUID,
    "defaultSupplierId" UUID,
    "strength" TEXT,
    "dosageForm" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "packSize" INTEGER NOT NULL DEFAULT 1,
    "barcode" TEXT,
    "sku" TEXT,
    "lowStockAlert" DECIMAL(12,2) NOT NULL DEFAULT 10,
    "defaultPurchasePrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "defaultSalePrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "rackLocation" TEXT,
    "description" TEXT,
    "status" "MedicineStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Medicine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicineBatch" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "medicineId" UUID NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "expiryDate" DATE NOT NULL,
    "purchasePrice" DECIMAL(12,2) NOT NULL,
    "salePrice" DECIMAL(12,2) NOT NULL,
    "mrp" DECIMAL(12,2),
    "initialQuantity" DECIMAL(12,2) NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "supplierId" UUID,
    "purchaseId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicineBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyPurchase" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "purchaseNo" TEXT NOT NULL,
    "supplierId" UUID NOT NULL,
    "invoiceNo" TEXT,
    "status" "PharmacyPurchaseStatus" NOT NULL DEFAULT 'ORDERED',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "additionalCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "returnedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "purchaseDate" DATE NOT NULL,
    "stockApplied" BOOLEAN NOT NULL DEFAULT false,
    "finalizedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PharmacyPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyPurchaseItem" (
    "id" UUID NOT NULL,
    "purchaseId" UUID NOT NULL,
    "medicineId" UUID NOT NULL,
    "batchId" UUID,
    "batchNumber" TEXT NOT NULL,
    "expiryDate" DATE NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "returnedQuantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "purchasePrice" DECIMAL(12,2) NOT NULL,
    "salePrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "PharmacyPurchaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyPurchaseReturn" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "returnNo" TEXT NOT NULL,
    "purchaseId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PharmacyPurchaseReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyPurchaseReturnItem" (
    "id" UUID NOT NULL,
    "returnId" UUID NOT NULL,
    "purchaseItemId" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "PharmacyPurchaseReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacySupplierPayment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "purchaseId" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "reference" TEXT,
    "notes" TEXT,
    "paidByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PharmacySupplierPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacySale" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "saleNo" TEXT NOT NULL,
    "patientId" UUID,
    "customerName" TEXT NOT NULL DEFAULT 'Walk-in Customer',
    "customerPhone" TEXT,
    "isWalkIn" BOOLEAN NOT NULL DEFAULT true,
    "status" "PharmacySaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PAID',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "itemDiscountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refundedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "soldByName" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PharmacySale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacySaleItem" (
    "id" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "medicineId" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "medicineName" TEXT NOT NULL,
    "genericName" TEXT,
    "strength" TEXT,
    "batchNumber" TEXT NOT NULL,
    "expiryDate" DATE NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "returnedQuantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "costPrice" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "PharmacySaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacySaleReturn" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "returnNo" TEXT NOT NULL,
    "saleId" UUID NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "refundAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reason" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PharmacySaleReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacySaleReturnItem" (
    "id" UUID NOT NULL,
    "returnId" UUID NOT NULL,
    "saleItemId" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "PharmacySaleReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyStockMovement" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "medicineId" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "type" "PharmacyStockMovementType" NOT NULL,
    "quantityChange" DECIMAL(12,2) NOT NULL,
    "balanceBefore" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "referenceNo" TEXT,
    "reason" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PharmacyStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyStockAdjustment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "medicineId" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "adjustmentType" "PharmacyAdjustmentType" NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "previousStock" DECIMAL(12,2) NOT NULL,
    "newStock" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "adjustedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PharmacyStockAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyPriceAudit" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "medicineId" UUID NOT NULL,
    "batchId" UUID,
    "oldPurchasePrice" DECIMAL(12,2),
    "newPurchasePrice" DECIMAL(12,2),
    "oldSalePrice" DECIMAL(12,2),
    "newSalePrice" DECIMAL(12,2),
    "reason" TEXT,
    "changedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PharmacyPriceAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MedicineCategory_organizationId_branchId_isActive_idx" ON "MedicineCategory"("organizationId", "branchId", "isActive");

-- CreateIndex
CREATE INDEX "MedicineCategory_organizationId_name_idx" ON "MedicineCategory"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "MedicineCategory_id_organizationId_key" ON "MedicineCategory"("id", "organizationId");

-- CreateIndex
CREATE INDEX "MedicineCompany_organizationId_branchId_isActive_idx" ON "MedicineCompany"("organizationId", "branchId", "isActive");

-- CreateIndex
CREATE INDEX "MedicineCompany_organizationId_name_idx" ON "MedicineCompany"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "MedicineCompany_id_organizationId_key" ON "MedicineCompany"("id", "organizationId");

-- CreateIndex
CREATE INDEX "Medicine_organizationId_branchId_status_idx" ON "Medicine"("organizationId", "branchId", "status");

-- CreateIndex
CREATE INDEX "Medicine_organizationId_branchId_name_idx" ON "Medicine"("organizationId", "branchId", "name");

-- CreateIndex
CREATE INDEX "Medicine_organizationId_branchId_barcode_idx" ON "Medicine"("organizationId", "branchId", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "Medicine_id_organizationId_key" ON "Medicine"("id", "organizationId");

-- CreateIndex
CREATE INDEX "MedicineBatch_organizationId_branchId_medicineId_expiryDate_idx" ON "MedicineBatch"("organizationId", "branchId", "medicineId", "expiryDate");

-- CreateIndex
CREATE INDEX "MedicineBatch_organizationId_branchId_expiryDate_idx" ON "MedicineBatch"("organizationId", "branchId", "expiryDate");

-- CreateIndex
CREATE INDEX "MedicineBatch_organizationId_branchId_quantity_idx" ON "MedicineBatch"("organizationId", "branchId", "quantity");

-- CreateIndex
CREATE UNIQUE INDEX "MedicineBatch_id_organizationId_key" ON "MedicineBatch"("id", "organizationId");

-- CreateIndex
CREATE INDEX "PharmacyPurchase_organizationId_branchId_purchaseDate_idx" ON "PharmacyPurchase"("organizationId", "branchId", "purchaseDate");

-- CreateIndex
CREATE INDEX "PharmacyPurchase_organizationId_branchId_status_idx" ON "PharmacyPurchase"("organizationId", "branchId", "status");

-- CreateIndex
CREATE INDEX "PharmacyPurchase_supplierId_idx" ON "PharmacyPurchase"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "PharmacyPurchase_organizationId_purchaseNo_key" ON "PharmacyPurchase"("organizationId", "purchaseNo");

-- CreateIndex
CREATE UNIQUE INDEX "PharmacyPurchase_id_organizationId_key" ON "PharmacyPurchase"("id", "organizationId");

-- CreateIndex
CREATE INDEX "PharmacyPurchaseItem_purchaseId_idx" ON "PharmacyPurchaseItem"("purchaseId");

-- CreateIndex
CREATE INDEX "PharmacyPurchaseItem_medicineId_idx" ON "PharmacyPurchaseItem"("medicineId");

-- CreateIndex
CREATE INDEX "PharmacyPurchaseReturn_organizationId_branchId_createdAt_idx" ON "PharmacyPurchaseReturn"("organizationId", "branchId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PharmacyPurchaseReturn_organizationId_returnNo_key" ON "PharmacyPurchaseReturn"("organizationId", "returnNo");

-- CreateIndex
CREATE INDEX "PharmacyPurchaseReturnItem_returnId_idx" ON "PharmacyPurchaseReturnItem"("returnId");

-- CreateIndex
CREATE INDEX "PharmacySupplierPayment_organizationId_branchId_createdAt_idx" ON "PharmacySupplierPayment"("organizationId", "branchId", "createdAt");

-- CreateIndex
CREATE INDEX "PharmacySupplierPayment_supplierId_idx" ON "PharmacySupplierPayment"("supplierId");

-- CreateIndex
CREATE INDEX "PharmacySale_organizationId_branchId_createdAt_idx" ON "PharmacySale"("organizationId", "branchId", "createdAt");

-- CreateIndex
CREATE INDEX "PharmacySale_organizationId_branchId_status_idx" ON "PharmacySale"("organizationId", "branchId", "status");

-- CreateIndex
CREATE INDEX "PharmacySale_organizationId_branchId_paymentStatus_idx" ON "PharmacySale"("organizationId", "branchId", "paymentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "PharmacySale_organizationId_saleNo_key" ON "PharmacySale"("organizationId", "saleNo");

-- CreateIndex
CREATE UNIQUE INDEX "PharmacySale_id_organizationId_key" ON "PharmacySale"("id", "organizationId");

-- CreateIndex
CREATE INDEX "PharmacySaleItem_saleId_idx" ON "PharmacySaleItem"("saleId");

-- CreateIndex
CREATE INDEX "PharmacySaleItem_medicineId_idx" ON "PharmacySaleItem"("medicineId");

-- CreateIndex
CREATE INDEX "PharmacySaleItem_batchId_idx" ON "PharmacySaleItem"("batchId");

-- CreateIndex
CREATE INDEX "PharmacySaleReturn_organizationId_branchId_createdAt_idx" ON "PharmacySaleReturn"("organizationId", "branchId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PharmacySaleReturn_organizationId_returnNo_key" ON "PharmacySaleReturn"("organizationId", "returnNo");

-- CreateIndex
CREATE INDEX "PharmacySaleReturnItem_returnId_idx" ON "PharmacySaleReturnItem"("returnId");

-- CreateIndex
CREATE INDEX "PharmacyStockMovement_organizationId_branchId_createdAt_idx" ON "PharmacyStockMovement"("organizationId", "branchId", "createdAt");

-- CreateIndex
CREATE INDEX "PharmacyStockMovement_medicineId_createdAt_idx" ON "PharmacyStockMovement"("medicineId", "createdAt");

-- CreateIndex
CREATE INDEX "PharmacyStockMovement_batchId_createdAt_idx" ON "PharmacyStockMovement"("batchId", "createdAt");

-- CreateIndex
CREATE INDEX "PharmacyStockAdjustment_organizationId_branchId_createdAt_idx" ON "PharmacyStockAdjustment"("organizationId", "branchId", "createdAt");

-- CreateIndex
CREATE INDEX "PharmacyStockAdjustment_medicineId_idx" ON "PharmacyStockAdjustment"("medicineId");

-- CreateIndex
CREATE INDEX "PharmacyPriceAudit_organizationId_branchId_createdAt_idx" ON "PharmacyPriceAudit"("organizationId", "branchId", "createdAt");

-- CreateIndex
CREATE INDEX "PharmacyPriceAudit_medicineId_idx" ON "PharmacyPriceAudit"("medicineId");

-- CreateIndex
CREATE INDEX "Payment_pharmacySaleId_idx" ON "Payment"("pharmacySaleId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_pharmacySaleId_organizationId_fkey" FOREIGN KEY ("pharmacySaleId", "organizationId") REFERENCES "PharmacySale"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineCategory" ADD CONSTRAINT "MedicineCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineCategory" ADD CONSTRAINT "MedicineCategory_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineCompany" ADD CONSTRAINT "MedicineCompany_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineCompany" ADD CONSTRAINT "MedicineCompany_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medicine" ADD CONSTRAINT "Medicine_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medicine" ADD CONSTRAINT "Medicine_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medicine" ADD CONSTRAINT "Medicine_categoryId_organizationId_fkey" FOREIGN KEY ("categoryId", "organizationId") REFERENCES "MedicineCategory"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medicine" ADD CONSTRAINT "Medicine_companyId_organizationId_fkey" FOREIGN KEY ("companyId", "organizationId") REFERENCES "MedicineCompany"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medicine" ADD CONSTRAINT "Medicine_defaultSupplierId_organizationId_fkey" FOREIGN KEY ("defaultSupplierId", "organizationId") REFERENCES "Supplier"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineBatch" ADD CONSTRAINT "MedicineBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineBatch" ADD CONSTRAINT "MedicineBatch_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineBatch" ADD CONSTRAINT "MedicineBatch_medicineId_organizationId_fkey" FOREIGN KEY ("medicineId", "organizationId") REFERENCES "Medicine"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineBatch" ADD CONSTRAINT "MedicineBatch_supplierId_organizationId_fkey" FOREIGN KEY ("supplierId", "organizationId") REFERENCES "Supplier"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineBatch" ADD CONSTRAINT "MedicineBatch_purchaseId_organizationId_fkey" FOREIGN KEY ("purchaseId", "organizationId") REFERENCES "PharmacyPurchase"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyPurchase" ADD CONSTRAINT "PharmacyPurchase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyPurchase" ADD CONSTRAINT "PharmacyPurchase_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyPurchase" ADD CONSTRAINT "PharmacyPurchase_supplierId_organizationId_fkey" FOREIGN KEY ("supplierId", "organizationId") REFERENCES "Supplier"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyPurchaseItem" ADD CONSTRAINT "PharmacyPurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "PharmacyPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyPurchaseItem" ADD CONSTRAINT "PharmacyPurchaseItem_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyPurchaseItem" ADD CONSTRAINT "PharmacyPurchaseItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "MedicineBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyPurchaseReturn" ADD CONSTRAINT "PharmacyPurchaseReturn_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyPurchaseReturn" ADD CONSTRAINT "PharmacyPurchaseReturn_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyPurchaseReturn" ADD CONSTRAINT "PharmacyPurchaseReturn_purchaseId_organizationId_fkey" FOREIGN KEY ("purchaseId", "organizationId") REFERENCES "PharmacyPurchase"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyPurchaseReturn" ADD CONSTRAINT "PharmacyPurchaseReturn_supplierId_organizationId_fkey" FOREIGN KEY ("supplierId", "organizationId") REFERENCES "Supplier"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyPurchaseReturnItem" ADD CONSTRAINT "PharmacyPurchaseReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "PharmacyPurchaseReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyPurchaseReturnItem" ADD CONSTRAINT "PharmacyPurchaseReturnItem_purchaseItemId_fkey" FOREIGN KEY ("purchaseItemId") REFERENCES "PharmacyPurchaseItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyPurchaseReturnItem" ADD CONSTRAINT "PharmacyPurchaseReturnItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "MedicineBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacySupplierPayment" ADD CONSTRAINT "PharmacySupplierPayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacySupplierPayment" ADD CONSTRAINT "PharmacySupplierPayment_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacySupplierPayment" ADD CONSTRAINT "PharmacySupplierPayment_supplierId_organizationId_fkey" FOREIGN KEY ("supplierId", "organizationId") REFERENCES "Supplier"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacySupplierPayment" ADD CONSTRAINT "PharmacySupplierPayment_purchaseId_organizationId_fkey" FOREIGN KEY ("purchaseId", "organizationId") REFERENCES "PharmacyPurchase"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacySale" ADD CONSTRAINT "PharmacySale_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacySale" ADD CONSTRAINT "PharmacySale_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacySale" ADD CONSTRAINT "PharmacySale_patientId_organizationId_fkey" FOREIGN KEY ("patientId", "organizationId") REFERENCES "Patient"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacySaleItem" ADD CONSTRAINT "PharmacySaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "PharmacySale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacySaleItem" ADD CONSTRAINT "PharmacySaleItem_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacySaleItem" ADD CONSTRAINT "PharmacySaleItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "MedicineBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacySaleReturn" ADD CONSTRAINT "PharmacySaleReturn_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacySaleReturn" ADD CONSTRAINT "PharmacySaleReturn_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacySaleReturn" ADD CONSTRAINT "PharmacySaleReturn_saleId_organizationId_fkey" FOREIGN KEY ("saleId", "organizationId") REFERENCES "PharmacySale"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacySaleReturnItem" ADD CONSTRAINT "PharmacySaleReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "PharmacySaleReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacySaleReturnItem" ADD CONSTRAINT "PharmacySaleReturnItem_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "PharmacySaleItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacySaleReturnItem" ADD CONSTRAINT "PharmacySaleReturnItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "MedicineBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyStockMovement" ADD CONSTRAINT "PharmacyStockMovement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyStockMovement" ADD CONSTRAINT "PharmacyStockMovement_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyStockMovement" ADD CONSTRAINT "PharmacyStockMovement_medicineId_organizationId_fkey" FOREIGN KEY ("medicineId", "organizationId") REFERENCES "Medicine"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyStockMovement" ADD CONSTRAINT "PharmacyStockMovement_batchId_organizationId_fkey" FOREIGN KEY ("batchId", "organizationId") REFERENCES "MedicineBatch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyStockAdjustment" ADD CONSTRAINT "PharmacyStockAdjustment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyStockAdjustment" ADD CONSTRAINT "PharmacyStockAdjustment_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyStockAdjustment" ADD CONSTRAINT "PharmacyStockAdjustment_medicineId_organizationId_fkey" FOREIGN KEY ("medicineId", "organizationId") REFERENCES "Medicine"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyStockAdjustment" ADD CONSTRAINT "PharmacyStockAdjustment_batchId_organizationId_fkey" FOREIGN KEY ("batchId", "organizationId") REFERENCES "MedicineBatch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyPriceAudit" ADD CONSTRAINT "PharmacyPriceAudit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyPriceAudit" ADD CONSTRAINT "PharmacyPriceAudit_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyPriceAudit" ADD CONSTRAINT "PharmacyPriceAudit_medicineId_organizationId_fkey" FOREIGN KEY ("medicineId", "organizationId") REFERENCES "Medicine"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyPriceAudit" ADD CONSTRAINT "PharmacyPriceAudit_batchId_organizationId_fkey" FOREIGN KEY ("batchId", "organizationId") REFERENCES "MedicineBatch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
