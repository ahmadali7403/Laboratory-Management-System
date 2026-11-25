// Permission catalogue used by Roles & Permissions. Keys are stored in the
// existing Permission table (created lazily by ensurePermissions()).
export const MODULES = [
  ["patients", "Patients"],
  ["doctors", "Doctors"],
  ["tests", "Test Catalog"],
  ["orders", "Laboratory Orders"],
  ["samples", "Sample Collection"],
  ["results", "Results Entry"],
  ["verification", "Result Verification"],
  ["reports", "Reports"],
  ["billing", "Billing & Payments"],
  ["expenses", "Expenses"],
  ["inventory", "Inventory"],
  ["suppliers", "Suppliers"],
  ["purchases", "Purchases"],
];

export const PERMISSION_CATALOG = MODULES.flatMap(([key, label]) => [
  { key: `${key}.view`, name: `View ${label}`, description: `View ${label.toLowerCase()} records.` },
  { key: `${key}.manage`, name: `Manage ${label}`, description: `Create, edit and delete ${label.toLowerCase()} records.` },
]);

export async function ensurePermissions(prisma) {
  await prisma.permission.createMany({
    data: PERMISSION_CATALOG.map((p) => ({ key: p.key, name: p.name, description: p.description })),
    skipDuplicates: true,
  });
}

// Keys the actor may hand out. A branch admin can never grant more than the catalogue
// entries available to branch level (no module is organization-only today, so this is the
// whole catalogue; keep the intersection so any future org-only key is rejected server-side).
const ORG_ONLY_KEYS = new Set([]);
export function grantableKeys(actor, requested) {
  const valid = new Set(PERMISSION_CATALOG.map((p) => p.key));
  return [...new Set(requested)].filter((k) => valid.has(k) && (actor.role !== "BRANCH_ADMIN" || !ORG_ONLY_KEYS.has(k)));
}
