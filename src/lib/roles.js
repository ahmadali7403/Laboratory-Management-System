/**
 * Role names are unique per scope:
 *   - organization-wide roles (branchId = null): unique inside the organization
 *   - branch roles: unique inside their branch (two branches may both have "Receptionist")
 * Postgres treats NULL as "distinct" in unique indexes, so the organization-wide case is
 * enforced here (and by assertRoleNameFree) rather than by the database alone.
 */

/** Finds or creates an organization-wide (system) role such as ORGANIZATION_ADMIN / BRANCH_ADMIN. */
export async function ensureSystemRole(tx, organizationId, name, description) {
  const existing = await tx.role.findFirst({ where: { organizationId, branchId: null, name } });
  if (existing) return existing;
  return tx.role.create({ data: { organizationId, name, description, isSystem: true } });
}

/**
 * Throws { userMessage } (-> HTTP 409) when `name` clashes with a role the new/renamed role would be
 * confused with:
 *   org-wide role  -> clashes with ANY role of that name in the organization
 *   branch role    -> clashes with an org-wide role or a role of the same branch
 */
export async function assertRoleNameFree(db, { organizationId, branchId, name, exceptId = null }) {
  const clash = await db.role.findFirst({
    where: {
      organizationId,
      name: { equals: name, mode: "insensitive" },
      ...(exceptId ? { id: { not: exceptId } } : {}),
      ...(branchId ? { OR: [{ branchId: null }, { branchId }] } : {}),
    },
    select: { branchId: true },
  });
  if (clash) {
    const where = clash.branchId ? "in a branch of this organization" : "for the whole organization";
    throw Object.assign(new Error("ROLE_NAME"), {
      userMessage: branchId
        ? `A role named “${name}” already exists ${where}.`
        : `A role named “${name}” already exists ${where}. Use a different name.`,
    });
  }
}
