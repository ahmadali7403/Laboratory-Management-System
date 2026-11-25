// Navigation is derived on the server from the authenticated role only.
// Every entry points at a real page; the server still enforces access on every request.
// `exact` = active only on that exact path (prevents /billing from lighting up on /billing/pay).
// `q` items (e.g. "?new=1") open the create form of the list page and are never marked active.
const L = (href, label, icon, extra = {}) => ({ href, label, icon, ...extra });
const G = (group, icon, children) => ({ group, icon, children });

const WORKFLOW = [
  G("Patients", "Users", [L("/patients?new=1", "Add Patient"), L("/patients", "Patient List", null, { exact: true })]),
  G("Orders", "ClipboardList", [L("/orders?new=1", "New Order"), L("/orders", "Order List", null, { exact: true })]),
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
  G("Doctors", "Stethoscope", [L("/doctors?new=1", "Add Doctor"), L("/doctors", "Doctor List", null, { exact: true })]),
  G("Inventory", "Boxes", [L("/inventory?new=1", "Add Inventory"), L("/inventory", "Inventory List", null, { exact: true }), L("/inventory/alerts", "Stock Alert"), L("/inventory/report", "Stock Report")]),
  G("Suppliers", "Truck", [L("/suppliers?new=1", "Add Supplier"), L("/suppliers", "Supplier List", null, { exact: true })]),
  L("/purchases", "Purchases", "ShoppingCart"),
];

export function buildNav({ actor, scope }) {
  const staff = G("Staff", "UserCog", [L("/staff?new=1", "Add Staff"), L("/staff", "Staff List", null, { exact: true })]);
  const roles = G("Roles", "ShieldCheck", [L("/roles?new=1", "Add New Role"), L("/roles", "Role List", null, { exact: true })]);
  const tail = [
    L("/analytics", "Reports & Analytics", "BarChart3"),
    L("/notifications", "Alerts", "Bell"),
    L("/backup", "Backup", "DatabaseBackup"),
  ];

  if (actor.role === "SUPER_ADMIN") {
    return [
      L("/dashboard", "Dashboard", "LayoutDashboard"),
      L("/organizations", "Organizations", "Building2"),
      L("/branches", "Branches", "GitBranch"),
      ...WORKFLOW, ...SETUP,
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
      ...WORKFLOW, ...SETUP,
      { section: "Admin" },
      staff, roles, ...tail,
      L("/settings", scope.branchId ? "Branch Settings" : "Org Settings", "Settings"),
    ];
  }
  return [
    L("/branch/dashboard", "Dashboard", "LayoutDashboard"),
    ...WORKFLOW, ...SETUP,
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
  ["/orders", "Walk-in patient", "?new=walkin", "Footprints"],
  ["/orders", "New test entry", "?new=1", "ClipboardList"],
  ["/billing/pay", "Receive payment", "", "Receipt"],
  ["/expenses", "Add expense", "?new=1", "Wallet"],
  ["/tests", "Add test", "?new=1", "TestTube"],
  ["/doctors", "Add doctor", "?new=1", "Stethoscope"],
  ["/inventory", "Add stock item", "?new=1", "Boxes"],
  ["/staff", "Add staff", "?new=1", "UserCog"],
];

export function buildQuick(items) {
  const have = new Set(flattenNav(items).map((i) => i.href.split("?")[0]));
  return QUICK.filter(([href]) => have.has(href)).map(([href, label, q, icon]) => ({ href: `${href}${q}`, label, icon }));
}
