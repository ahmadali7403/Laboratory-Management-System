import { ensurePermissions, PERMISSION_CATALOG } from "@/lib/permissions";

// Standard laboratory roles created for every branch. `manage` always includes `view`.
const ALL = [...new Set(PERMISSION_CATALOG.map((p) => p.key.split(".")[0]))];
export const DEFAULT_ROLES = [
  { name: "Lab Manager", description: "Runs the whole laboratory branch.", manage: ALL, view: [] },
  { name: "Receptionist", description: "Registers patients, creates orders and takes bills at the counter.", manage: ["patients", "orders"], view: ["tests", "billing", "samples", "reports"] },
  { name: "Cashier", description: "Receives payments, prints invoices and records expenses.", manage: ["billing", "expenses"], view: ["orders", "patients", "reports"] },
  { name: "Phlebotomist", description: "Collects and receives samples.", manage: ["samples"], view: ["orders", "patients", "tests"] },
  { name: "Lab Technician", description: "Handles samples and enters results.", manage: ["samples", "results"], view: ["orders", "patients", "tests", "inventory"] },
  { name: "Pathologist", description: "Verifies results and signs reports.", manage: ["verification"], view: ["results", "reports", "orders", "patients", "tests"] },
  { name: "Report Desk", description: "Delivers and prints finished reports.", manage: [], view: ["reports", "orders", "patients", "billing"] },
  { name: "Store Keeper", description: "Manages inventory, suppliers and purchases.", manage: ["inventory", "suppliers", "purchases"], view: ["expenses"] },
  { name: "Consultant Doctor", description: "Views patients, orders, results and reports.", manage: [], view: ["patients", "orders", "results", "reports", "tests"] },
  {
    name: "Pharmacy Staff",
    description: "Operates Pharmacy POS, views medicine inventory, sales, stock and expiry alerts.",
    manage: ["pharmacy_pos"],
    view: ["pharmacy", "pharmacy_inventory"],
  },
  {
    name: "Pharmacy Manager",
    description: "Manages complete pharmacy inventory, purchases, suppliers, POS, stock adjustments and reports.",
    manage: ["pharmacy", "pharmacy_pos", "pharmacy_inventory", "pharmacy_purchases", "pharmacy_suppliers", "pharmacy_reports"],
    view: [],
  },
];

const keysOf = (r) => [...new Set([...r.manage.flatMap((m) => [`${m}.view`, `${m}.manage`]), ...r.view.map((m) => `${m}.view`)])];

/**
 * Creates the standard roles for ONE branch. Roles whose name already exists (organization-wide
 * or in that branch) are skipped, so it is safe to run again. Returns how many were created.
 */
export async function seedDefaultRoles(db, organizationId, branchId) {
  await ensurePermissions(db);
  const perms = await db.permission.findMany({ select: { id: true, key: true } });
  const idOf = new Map(perms.map((p) => [p.key, p.id]));
  const existing = await db.role.findMany({
    where: { organizationId, OR: [{ branchId: null }, { branchId }] },
    select: { name: true },
  });
  const taken = new Set(existing.map((r) => r.name.toLowerCase()));
  let created = 0;
  for (const r of DEFAULT_ROLES) {
    if (taken.has(r.name.toLowerCase())) continue;
    await db.role.create({
      data: {
        organizationId, branchId, name: r.name, description: r.description,
        permissions: { create: keysOf(r).filter((k) => idOf.has(k)).map((k) => ({ permissionId: idOf.get(k) })) },
      },
    });
    created += 1;
  }
  return created;
}

/** Seeds a branch once (first time its roles are needed). A marker row stops it from coming back after deletes. */
export async function ensureBranchDefaults(db, organizationId, branchId) {
  const key = `default-roles:${branchId}`;
  const made = await db.sequence.createMany({ data: [{ organizationId, key, value: 1 }], skipDuplicates: true });
  if (made.count === 0) {
    // One-time upgrade marker so existing branches also receive the Pharmacy standard roles once.
    const pharmKey = `default-roles-pharmacy:${branchId}`;
    const pharmMade = await db.sequence.createMany({ data: [{ organizationId, key: pharmKey, value: 1 }], skipDuplicates: true });
    if (pharmMade.count === 0) return 0;
    try {
      return await seedDefaultRoles(db, organizationId, branchId);
    } catch (e) {
      await db.sequence.deleteMany({ where: { organizationId, key: pharmKey } });
      throw e;
    }
  }
  try {
    await db.sequence.createMany({ data: [{ organizationId, key: `default-roles-pharmacy:${branchId}`, value: 1 }], skipDuplicates: true });
    return await seedDefaultRoles(db, organizationId, branchId);
  } catch (e) {
    await db.sequence.deleteMany({ where: { organizationId, key } }); // try again next time
    throw e;
  }
}
