-- Role names become unique per scope (organization-wide OR per branch) instead of per organization,
-- so two branches can each define their own "Receptionist". Organization-wide uniqueness
-- (branchId IS NULL) is enforced in the API because NULLs are distinct in unique indexes.
DROP INDEX IF EXISTS "Role_organizationId_name_key";
CREATE UNIQUE INDEX "Role_organizationId_branchId_name_key" ON "Role"("organizationId", "branchId", "name");
