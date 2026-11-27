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

// ---------------------------------------------------------------------------
// STAFF ACCESS (login users whose role is not ORGANIZATION_ADMIN / BRANCH_ADMIN)
// Everything a staff member may do is decided by the permission keys of their role(s).
// `manage` implies `view`.
// ---------------------------------------------------------------------------
export const hasModule = (perms, module, write = false) =>
  write ? perms.includes(`${module}.manage`) : perms.includes(`${module}.view`) || perms.includes(`${module}.manage`);

const API_MODULES = new Set(["patients", "tests", "orders", "samples", "results", "reports", "billing", "expenses", "inventory", "suppliers", "purchases"]);
const LOOKUPS = new Set(["patients", "tests"]); // read-only lists the order screen needs
// Modules whose screens are built on the order list (billing, reports, samples, results ...).
export const ORDER_READERS = ["orders", "billing", "reports", "samples", "results", "verification"];

/** Decides whether a staff member may call an API path with this HTTP method. Default = deny. */
export function staffMayCall(perms, pathname, method, search = "") {
  const parts = pathname.split("/").filter(Boolean); // ["api", "orders", "<id>", "payments"]
  const seg = parts[1];
  const write = method !== "GET" && method !== "HEAD";
  if (seg === "notifications") return true;
  if (seg === "pharmacy") {
    const sub = parts[2];
    if (sub === "dashboard") return !write && (hasModule(perms, "pharmacy") || hasModule(perms, "pharmacy_pos") || hasModule(perms, "pharmacy_inventory"));
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
    if (sub === "sales") return hasModule(perms, "pharmacy_pos", write);
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

/** Page access: module key of a ModulePage name + variant (results verify/reopen use "verification"). */
export const pageModule = (name, variant) => (name === "results" && (variant === "verify" || variant === "reopen") ? "verification" : name);
