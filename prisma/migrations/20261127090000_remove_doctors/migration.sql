-- Doctor module removed.
ALTER TABLE "LabOrder" DROP CONSTRAINT IF EXISTS "LabOrder_doctorId_organizationId_fkey";
ALTER TABLE "LabOrder" DROP COLUMN IF EXISTS "doctorId";
DROP TABLE IF EXISTS "Doctor";
