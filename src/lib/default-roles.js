import { ensurePermissions, PERMISSION_CATALOG } from "@/lib/permissions";

const ALL = PERMISSION_CATALOG.map((p) => p.key);

export const DEFAULT_ROLES = [
  {
    name: "Lab Manager",
    description: "Runs the whole laboratory branch.",
    manage: ALL,
    view: [],
    extra: ["pos.discount", "pos.discount_override", "pos.void", "pos.refund", "pos.shift_own", "inventory.cost_view"],
    maxDiscountPct: 100,
    canEditPrice: true,
    requireShift: false,
  },
  {
    name: "Receptionist",
    description: "Registers patients, creates orders and takes bills at the counter.",
    manage: ["patients", "orders"],
    view: ["tests", "billing", "samples", "reports"],
    extra: ["pos.discount", "pos.shift_own"],
    maxDiscountPct: 15,
    canEditPrice: false,
    requireShift: false,
  },
  {
    name: "Cashier",
    description: "Receives payments, prints invoices and records expenses.",
    manage: ["billing", "expenses"],
    view: ["orders", "patients", "reports"],
    extra: ["pos.discount", "pos.shift_own"],
    maxDiscountPct: 10,
    canEditPrice: false,
    requireShift: false,
  },
  {
    name: "Phlebotomist",
    description: "Collects and receives samples.",
    manage: ["samples"],
    view: ["orders", "patients", "tests"],
    extra: [],
    maxDiscountPct: 0,
    canEditPrice: false,
  },
  {
    name: "Lab Technician",
    description: "Handles samples and enters results (no cost/financial access).",
    manage: ["samples", "results"],
    view: ["orders", "patients", "tests", "inventory"],
    extra: [],
    maxDiscountPct: 0,
    canEditPrice: false,
  },
  {
    name: "Pathologist",
    description: "Verifies results and signs reports.",
    manage: ["verification"],
    view: ["results", "reports", "orders", "patients", "tests"],
    extra: [],
    maxDiscountPct: 0,
    canEditPrice: false,
  },
  {
    name: "Report Desk",
    description: "Delivers and prints finished reports.",
    manage: [],
    view: ["reports", "orders", "patients", "billing"],
    extra: [],
    maxDiscountPct: 0,
    canEditPrice: false,
  },
  {
    name: "Store Keeper",
    description: "Manages lab & pharmacy inventory, suppliers, stock adjustments, and purchases.",
    manage: ["inventory", "suppliers", "purchases", "pharmacy_inventory", "pharmacy_purchases", "pharmacy_suppliers"],
    view: ["expenses", "pharmacy"],
    extra: ["inventory.cost_view"],
    maxDiscountPct: 0,
    canEditPrice: true,
  },
  {
    name: "Consultant Doctor",
    description: "Views patients, orders, results and reports.",
    manage: [],
    view: ["patients", "orders", "results", "reports", "tests"],
    extra: [],
    maxDiscountPct: 0,
    canEditPrice: false,
  },
  {
    name: "Pharmacy Staff",
    description: "Operates Pharmacy POS, views medicine inventory, sales, stock and expiry alerts.",
    manage: ["pharmacy_pos"],
    view: ["pharmacy", "pharmacy_inventory"],
    extra: ["pos.discount", "pos.shift_own"],
    maxDiscountPct: 10,
    canEditPrice: false,
    requireShift: true,
  },
  {
    name: "Pharmacy Manager",
    description: "Manages complete pharmacy inventory, purchases, suppliers, POS, discounts, refunds and reports.",
    manage: ["pharmacy", "pharmacy_pos", "pharmacy_inventory", "pharmacy_purchases", "pharmacy_suppliers", "pharmacy_reports"],
    view: [],
    extra: ["pos.discount", "pos.discount_override", "pos.void", "pos.refund", "pos.shift_own", "inventory.cost_view"],
    maxDiscountPct: 100,
    canEditPrice: true,
    requireShift: false,
  },
  {
    name: "Pharmacist",
    description: "Dispenses medicines, handles Pharmacy POS, returns and manages medicine catalog.",
    manage: ["pharmacy_pos", "pharmacy_inventory"],
    view: ["pharmacy"],
    extra: ["pos.discount", "pos.refund", "pos.shift_own"],
    maxDiscountPct: 15,
    canEditPrice: false,
    requireShift: true,
  },
  {
    name: "Pharmacy POS",
    description: "Restricted Pharmacy Cashier: POS billing & own shift only (no cost/profit, inventory edits, or reports).",
    manage: ["pharmacy_pos"],
    view: [],
    extra: ["pos.discount", "pos.shift_own"],
    maxDiscountPct: 10,
    canEditPrice: false,
    requireShift: true,
  },
  {
    name: "Lab POS",
    description: "Restricted Lab Counter Cashier: registers walk-in/registered lab orders and takes payments.",
    manage: ["patients", "orders", "billing"],
    view: ["tests", "reports"],
    extra: ["pos.discount", "pos.shift_own"],
    maxDiscountPct: 10,
    canEditPrice: false,
    requireShift: false,
  },
  {
    name: "Accountant",
    description: "Read-only financial & stock valuation reports across Lab and Pharmacy.",
    manage: [],
    view: ["reports", "billing", "expenses", "orders", "pharmacy", "pharmacy_reports", "pharmacy_purchases", "pharmacy_suppliers", "pharmacy_pos"],
    extra: ["inventory.cost_view"],
    maxDiscountPct: 0,
    canEditPrice: false,
    requireShift: false,
  },
];

const keysOf = (r) => {
  const modKeys = r.manage.flatMap((m) => (m.includes(".") ? [m] : [`${m}.view`, `${m}.manage`]));
  const viewKeys = r.view.map((m) => (m.includes(".") ? m : `${m}.view`));
  return [...new Set([...modKeys, ...viewKeys, ...(r.extra || [])])];
};

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
        organizationId,
        branchId,
        name: r.name,
        description: r.description,
        maxDiscountPct: r.maxDiscountPct ?? 100,
        canEditPrice: r.canEditPrice ?? true,
        allowedMethods: r.allowedMethods || [],
        requireShift: r.requireShift ?? false,
        permissions: {
          create: keysOf(r)
            .filter((k) => idOf.has(k))
            .map((k) => ({ permissionId: idOf.get(k) })),
        },
      },
    });
    created += 1;
  }
  return created;
}

/** Seeds a branch once, plus backfills new RBAC v2 roles on existing branches once. */
export async function ensureBranchDefaults(db, organizationId, branchId) {
  const key = `default-roles:${branchId}`;
  const v2Key = `default-roles-rbac-v2:${branchId}`;
  const made = await db.sequence.createMany({ data: [{ organizationId, key, value: 1 }], skipDuplicates: true });
  if (made.count === 0) {
    const v2Made = await db.sequence.createMany({ data: [{ organizationId, key: v2Key, value: 1 }], skipDuplicates: true });
    if (v2Made.count === 0) return 0;
    try {
      return await seedDefaultRoles(db, organizationId, branchId);
    } catch (e) {
      await db.sequence.deleteMany({ where: { organizationId, key: v2Key } });
      throw e;
    }
  }
  try {
    await db.sequence.createMany({
      data: [
        { organizationId, key: `default-roles-pharmacy:${branchId}`, value: 1 },
        { organizationId, key: v2Key, value: 1 },
      ],
      skipDuplicates: true,
    });
    return await seedDefaultRoles(db, organizationId, branchId);
  } catch (e) {
    await db.sequence.deleteMany({ where: { organizationId, key } });
    throw e;
  }
}
