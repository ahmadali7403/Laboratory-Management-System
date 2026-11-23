-- AlterTable
ALTER TABLE "Patient" ADD COLUMN "fatherName" TEXT,
ADD COLUMN "isWalkIn" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "LabOrder" ADD COLUMN "referredBy" TEXT;
