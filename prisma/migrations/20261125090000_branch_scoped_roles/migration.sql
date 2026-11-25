-- Additive: a role with branchId NULL is organization-wide (existing behaviour);
-- a role with a branchId exists only inside that branch. Existing rows stay organization-wide.
ALTER TABLE "Role" ADD COLUMN "branchId" UUID;
ALTER TABLE "Role" ADD CONSTRAINT "Role_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Role_organizationId_branchId_idx" ON "Role"("organizationId", "branchId");
