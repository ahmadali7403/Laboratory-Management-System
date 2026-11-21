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
