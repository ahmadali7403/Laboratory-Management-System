// Permission catalogue used by Roles & Permissions. Keys are stored in the
// existing Permission table (created lazily by ensurePermissions()).
export const MODULES = [
  ["patients", "Patients"],
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
  ["pharmacy", "Pharmacy Dashboard & Alerts"],
  ["pharmacy_pos", "Pharmacy POS & Sales"],
  ["pharmacy_inventory", "Medicine Inventory"],
  ["pharmacy_purchases", "Pharmacy Purchases"],
  ["pharmacy_suppliers", "Pharmacy Suppliers"],
  ["pharmacy_reports", "Pharmacy Reports"],
];

export const EXTRA_PERMISSIONS = [
  { key: "pos.discount", name: "POS Apply Discount", description: "Apply discounts on POS bills up to the role's maximum discount %." },
  { key: "pos.discount_override", name: "POS Discount Override", description: "Approve discounts above cashier limit via manager PIN." },
  { key: "pos.void", name: "POS Void / Cancel", description: "Void or cancel completed POS bills." },
  { key: "pos.refund", name: "POS Returns & Refunds", description: "Process medicine returns and customer refunds." },
  { key: "pos.shift_own", name: "POS Own Shift", description: "Open/close own POS shift and print own shift report." },
  { key: "inventory.cost_view", name: "View Cost & Profit", description: "View purchase prices, stock valuation, and profit margins." },
];

export const PERMISSION_CATALOG = [
  ...MODULES.flatMap(([key, label]) => [
    { key: `${key}.view`, name: `View ${label}`, description: `View ${label.toLowerCase()} records.` },
    { key: `${key}.manage`, name: `Manage ${label}`, description: `Create, edit and delete ${label.toLowerCase()} records.` },
  ]),
  ...EXTRA_PERMISSIONS,
];

export async function ensurePermissions(prisma) {
  await prisma.permission.createMany({
    data: PERMISSION_CATALOG.map((p) => ({ key: p.key, name: p.name, description: p.description })),
    skipDuplicates: true,
  });
}

const ORG_ONLY_KEYS = new Set([]);
export function grantableKeys(actor, requested) {
  const valid = new Set(PERMISSION_CATALOG.map((p) => p.key));
  return [...new Set(requested)].filter((k) => valid.has(k) && (actor.role !== "BRANCH_ADMIN" || !ORG_ONLY_KEYS.has(k)));
}

// ---------------------------------------------------------------------------
// STAFF ACCESS (login users whose role is not ORGANIZATION_ADMIN / BRANCH_ADMIN)
// Everything a staff member may do is decided by the permission keys of their role(s).
// `manage` implies `view`.
// ---------------------------------------------------------------------------
export const hasModule = (perms = [], module, write = false) =>
  write ? perms.includes(`${module}.manage`) : perms.includes(`${module}.view`) || perms.includes(`${module}.manage`);

export const hasPermission = (perms = [], key) => perms.includes(key);

export function canViewCosts(actor) {
  if (!actor) return false;
  if (actor.role !== "STAFF") return true;
  return (
    hasPermission(actor.permissions, "inventory.cost_view") ||
    hasModule(actor.permissions, "pharmacy_purchases", true)
  );
}

/** Strips cost / profit / margin keys from objects when the caller may not view costs. */
export function stripCostFields(item) {
  if (!item || typeof item !== "object") return item;
  const copy = { ...item };
  delete copy.purchasePrice;
  delete copy.defaultPurchasePrice;
  delete copy.costPrice;
  delete copy.stockValue;
  delete copy.totalCost;
  delete copy.grossProfit;
  delete copy.profit;
  delete copy.margin;
  delete copy.profitMarginPct;
  if (Array.isArray(copy.batches)) copy.batches = copy.batches.map(stripCostFields);
  if (Array.isArray(copy.validBatches)) copy.validBatches = copy.validBatches.map(stripCostFields);
  if (Array.isArray(copy.expiredBatches)) copy.expiredBatches = copy.expiredBatches.map(stripCostFields);
  if (Array.isArray(copy.items)) copy.items = copy.items.map(stripCostFields);
  return copy;
}

const API_MODULES = new Set(["patients", "tests", "orders", "samples", "results", "reports", "billing", "expenses", "inventory", "suppliers", "purchases"]);
const LOOKUPS = new Set(["patients", "tests"]);

export const ORDER_READERS = ["orders", "billing", "reports", "samples", "results", "verification"];

/** Decides whether a staff member may call an API path with this HTTP method. Default = deny. */
export function staffMayCall(perms = [], pathname, method, search = "") {
  const parts = pathname.split("/").filter(Boolean);
  const seg = parts[1];
  const write = method !== "GET" && method !== "HEAD";
  if (seg === "notifications") return true;
  if (seg === "pharmacy") {
    const sub = parts[2];
    if (sub === "shifts") return hasModule(perms, "pharmacy_pos") || hasPermission(perms, "pos.shift_own") || hasModule(perms, "pharmacy");
    if (sub === "dashboard") return !write && (hasModule(perms, "pharmacy") || hasModule(perms, "pharmacy_inventory"));
    if (sub === "alerts") return !write && (hasModule(perms, "pharmacy") || hasModule(perms, "pharmacy_inventory"));
    if (sub === "reports") return !write && (hasModule(perms, "pharmacy_reports") || hasModule(perms, "pharmacy"));
    if (sub === "customers") return !write && hasModule(perms, "pharmacy_pos");
    if (["categories", "companies", "medicines", "batches"].includes(sub)) {
      if (write) return hasModule(perms, "pharmacy_inventory", true);
      return hasModule(perms, "pharmacy_inventory") || hasModule(perms, "pharmacy_pos") || hasModule(perms, "pharmacy_purchases");
    }
    if (sub === "stock") {
      return write
        ? hasModule(perms, "pharmacy_inventory", true) || hasModule(perms, "pharmacy", true)
        : hasModule(perms, "pharmacy_inventory") || hasModule(perms, "pharmacy");
    }
    if (sub === "suppliers") {
      if (write) return hasModule(perms, "pharmacy_suppliers", true);
      if (search.includes("options=1") && (hasModule(perms, "pharmacy_purchases", true) || hasModule(perms, "pharmacy_inventory", true))) return true;
      return hasModule(perms, "pharmacy_suppliers");
    }
    if (sub === "purchases") return hasModule(perms, "pharmacy_purchases", write);
    if (sub === "sales") return hasModule(perms, "pharmacy_pos", write) || (!write && (hasModule(perms, "pharmacy") || hasModule(perms, "pharmacy_reports")));
    return false;
  }
  if (seg === "view") {
    if (method !== "GET") return false;
    if (parts[2] === "orders") return ORDER_READERS.some((m) => hasModule(perms, m));
    return API_MODULES.has(parts[2]) && hasModule(perms, parts[2]);
  }
  if (seg === "orders" && parts[3] === "payments") return hasModule(perms, "billing", true) || hasModule(perms, "orders", true);
  if (!write && LOOKUPS.has(seg) && (hasModule(perms, "orders") || hasModule(perms, "billing"))) return true;
  if (!write && seg === "orders" && ORDER_READERS.some((m) => hasModule(perms, m))) return true;
  if (seg === "results") return hasModule(perms, "results", write) || hasModule(perms, "verification", write);
  if (API_MODULES.has(seg)) return hasModule(perms, seg, write);
  return false;
}

export function pageModule(name, variant) {
  if (name === "results" && ["verify", "reopen"].includes(variant)) return "verification";
  return name;
}
