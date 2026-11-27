import { hasModule } from "@/lib/permissions";

// Navigation is derived on the server from the authenticated role only.
// Every entry points at a real page; the server still enforces access on every request.
// `exact` = active only on that exact path (prevents /billing from lighting up on /billing/pay).
// `q` items (e.g. "?new=1") open the create form of the list page and are never marked active.
const L = (href, label, icon, extra = {}) => ({ href, label, icon, ...extra });
const G = (group, icon, children) => ({ group, icon, children });

const WORKFLOW = [
  G("Patients", "Users", [L("/patients?new=1", "Add Patient"), L("/patients", "Patient List", null, { exact: true })]),
  G("Orders", "ClipboardList", [L("/orders/new", "New Order", null, { exact: true }), L("/orders", "Order List", null, { exact: true })]),
  G("Samples", "Droplets", [
    L("/samples/collect", "Collect Sample"), L("/samples/receive", "Receive Sample"),
    L("/samples/reject", "Reject Sample"), L("/samples/list", "Sample List"),
  ]),
  G("Results", "FlaskConical", [
    L("/results/enter", "Enter Result"), L("/results/edit", "Edit Result"), L("/results/verify", "Verify Result"),
    L("/results/reopen", "Reopen Result"), L("/results/list", "Result List"),
  ]),
  L("/reports", "Lab Reports", "FileText"),
  G("Billing", "Receipt", [L("/billing/pay", "Pay Bill"), L("/billing", "Invoice List", null, { exact: true })]),
  G("Expenses", "Wallet", [L("/expenses?new=1", "New Expense"), L("/expenses", "Expense List", null, { exact: true })]),
];
const SETUP = [
  G("Tests", "TestTube", [L("/tests?new=1", "Add Test"), L("/tests", "Test List", null, { exact: true })]),
  G("Inventory", "Boxes", [L("/inventory?new=1", "Add Inventory"), L("/inventory", "Inventory List", null, { exact: true }), L("/inventory/alerts", "Stock Alert"), L("/inventory/report", "Stock Report")]),
  G("Suppliers", "Truck", [L("/suppliers?new=1", "Add Supplier"), L("/suppliers", "Supplier List", null, { exact: true })]),
  L("/purchases", "Purchases", "ShoppingCart"),
];
const PHARMACY = [
  G("Pharmacy", "Pill", [
    L("/pharmacy", "Dashboard", null, { exact: true }),
    L("/pharmacy/pos", "Pharmacy POS", null, { exact: true }),
    L("/pharmacy/sales", "Pharmacy Sales", null, { exact: true }),
    L("/pharmacy/inventory", "Medicine Inventory", null, { exact: true }),
    L("/pharmacy/categories", "Categories", null, { exact: true }),
    L("/pharmacy/companies", "Companies", null, { exact: true }),
    L("/pharmacy/suppliers", "Suppliers", null, { exact: true }),
    L("/pharmacy/purchases", "Purchases", null, { exact: true }),
    L("/pharmacy/stock", "Stock & Adjustments", null, { exact: true }),
    L("/pharmacy/alerts", "Low Stock & Expiry", null, { exact: true }),
    L("/pharmacy/reports", "Pharmacy Reports", null, { exact: true }),
  ]),
];

// What a staff member needs for each menu entry: [permission module(s), needs "manage"].
// Entries that open a create form (?new=1) always need "manage".
const NEED = {
  "/patients": ["patients"], "/orders/new": ["orders", true], "/orders": ["orders"],
  "/samples/collect": ["samples", true], "/samples/receive": ["samples", true], "/samples/reject": ["samples", true], "/samples/list": ["samples"],
  "/results/enter": ["results", true], "/results/edit": ["results", true], "/results/verify": ["verification"], "/results/reopen": ["verification", true], "/results/list": ["results"],
  "/reports": ["reports"], "/billing/pay": ["billing", true], "/billing": ["billing"], "/expenses": ["expenses"],
  "/tests": ["tests"], "/inventory": ["inventory"], "/inventory/alerts": ["inventory"], "/inventory/report": ["inventory"],
  "/suppliers": ["suppliers"], "/purchases": ["purchases"],
  "/pharmacy": [["pharmacy", "pharmacy_pos", "pharmacy_inventory"]],
  "/pharmacy/pos": ["pharmacy_pos", true],
  "/pharmacy/sales": ["pharmacy_pos"],
  "/pharmacy/inventory": ["pharmacy_inventory"],
  "/pharmacy/categories": ["pharmacy_inventory"],
  "/pharmacy/companies": ["pharmacy_inventory"],
  "/pharmacy/suppliers": ["pharmacy_suppliers"],
  "/pharmacy/purchases": ["pharmacy_purchases"],
  "/pharmacy/stock": [["pharmacy_inventory", "pharmacy"]],
  "/pharmacy/alerts": [["pharmacy", "pharmacy_inventory"]],
  "/pharmacy/reports": [["pharmacy_reports", "pharmacy"]],
};

function staffNav(perms) {
  const ok = (item) => {
    const need = NEED[item.href.split("?")[0]];
    if (!need) return false;
    const mods = Array.isArray(need[0]) ? need[0] : [need[0]];
    const write = Boolean(need[1]) || item.href.includes("?new");
    return mods.some((m) => hasModule(perms, m, write));
  };
  const out = [];
  for (const item of [...WORKFLOW, ...PHARMACY, ...SETUP]) {
    if (item.children) {
      const children = item.children.filter(ok);
      if (children.length) out.push({ ...item, children });
    } else if (ok(item)) out.push(item);
  }
  return [L("/home", "Home", "LayoutDashboard", { exact: true }), ...out, L("/notifications", "Alerts", "Bell")];
}

export function buildNav({ actor, scope }) {
  if (actor.role === "STAFF") return staffNav(actor.permissions);
  const staff = G("Staff", "UserCog", [L("/staff?new=1", "Add Staff"), L("/staff", "Staff List", null, { exact: true })]);
  const roles = G("Roles", "ShieldCheck", [L("/roles?new=1", "Add New Role"), L("/roles", "Role List", null, { exact: true })]);
  const tail = [
    L("/analytics", "Reports & Analytics", "BarChart3"),
    L("/audit-logs", "Audit Logs", "ShieldCheck"),
    L("/notifications", "Alerts", "Bell"),
    L("/backup", "Backup", "DatabaseBackup"),
  ];

  if (actor.role === "SUPER_ADMIN") {
    return [
      L("/dashboard", "Dashboard", "LayoutDashboard"),
      L("/organizations", "Organizations", "Building2"),
      L("/branches", "Branches", "GitBranch"),
      ...WORKFLOW, ...PHARMACY, ...SETUP,
      { section: "Admin" },
      staff, roles, ...tail,
      ...(scope.organizationId ? [L("/settings", scope.branchId ? "Branch Settings" : "Org Settings", "Settings")] : []),
      L("/platform-settings", "Platform", "SlidersHorizontal"),
    ];
  }
  if (actor.role === "ORGANIZATION_ADMIN") {
    return [
      L("/organization/dashboard", "Dashboard", "LayoutDashboard"),
      L(`/organizations/${actor.organizationId}/branches`, "Branches", "GitBranch"),
      ...WORKFLOW, ...PHARMACY, ...SETUP,
      { section: "Admin" },
      staff, roles, ...tail,
      L("/settings", scope.branchId ? "Branch Settings" : "Org Settings", "Settings"),
    ];
  }
  return [
    L("/branch/dashboard", "Dashboard", "LayoutDashboard"),
    ...WORKFLOW, ...PHARMACY, ...SETUP,
    { section: "Admin" },
    staff, roles, ...tail,
    L("/settings", "Settings", "Settings"),
  ];
}

export const flattenNav = (items) =>
  items.flatMap((i) => (i.children ? i.children : i.href ? [i] : []));

// Quick-access (+) actions: only offered when the module is in the user's own navigation.
const QUICK = [
  ["/patients", "Add patient", "?new=1", "UserPlus"],
  ["/orders/new", "Walk-in patient", "?walkin=1", "Footprints"],
  ["/orders/new", "New order", "", "ClipboardList"],
  ["/pharmacy/pos", "Pharmacy POS", "", "Pill"],
  ["/pharmacy/purchases", "Pharmacy purchase", "?new=1", "ShoppingCart"],
  ["/billing/pay", "Receive payment", "", "Receipt"],
  ["/expenses", "Add expense", "?new=1", "Wallet"],
  ["/tests", "Add test", "?new=1", "TestTube"],
  ["/inventory", "Add stock item", "?new=1", "Boxes"],
  ["/staff", "Add staff", "?new=1", "UserCog"],
];

export function buildQuick(items) {
  const have = new Set(flattenNav(items).map((i) => i.href.split("?")[0]));
  return QUICK.filter(([href]) => have.has(href)).map(([href, label, q, icon]) => ({ href: `${href}${q}`, label, icon }));
}
