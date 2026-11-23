-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "reportConsultants" TEXT,
ADD COLUMN "reportFooterNote" TEXT;

-- CreateTable
CREATE TABLE "TestParameter" (
    "id" UUID NOT NULL,
    "testId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "refLow" DECIMAL(12,4),
    "refHigh" DECIMAL(12,4),
    "refRangeText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TestParameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabResult" (
    "id" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "refLow" DECIMAL(12,4),
    "refHigh" DECIMAL(12,4),
    "refRangeText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "value" TEXT,
    "flag" "ResultFlag" NOT NULL DEFAULT 'NORMAL',

    CONSTRAINT "LabResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TestParameter_testId_sortOrder_idx" ON "TestParameter"("testId", "sortOrder");

-- CreateIndex
CREATE INDEX "LabResult_orderItemId_sortOrder_idx" ON "LabResult"("orderItemId", "sortOrder");

-- AddForeignKey
ALTER TABLE "TestParameter" ADD CONSTRAINT "TestParameter_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "LabOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
