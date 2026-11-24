// Navigation is derived on the server from the authenticated role only.
// Frequently used modules first, rarely used ones at the bottom, related ones grouped.
const L = (href, label, icon) => ({ href, label, icon });

const CORE = [
  L("/patients", "Patients", "Users"),
  L("/orders", "Orders", "ClipboardList"),
  L("/samples", "Samples", "Droplets"),
  L("/results", "Results", "FlaskConical"),
  L("/reports", "Reports", "FileText"),
  L("/billing", "Billing", "Receipt"),
  L("/expenses", "Expenses", "Wallet"),
];
const SETUP = [
  { group: "Catalog", icon: "TestTube", children: [L("/tests", "Tests", "TestTube"), L("/doctors", "Doctors", "Stethoscope")] },
  { group: "Stock", icon: "Boxes", children: [L("/inventory", "Inventory", "Boxes"), L("/suppliers", "Suppliers", "Truck"), L("/purchases", "Purchases", "ShoppingCart")] },
];

export function buildNav({ actor, scope }) {
  const staff = L("/staff", "Staff", "UserCog");
  const roles = L("/roles", "Roles", "ShieldCheck");
  const tail = [
    L("/analytics", "Analytics", "BarChart3"),
    L("/notifications", "Alerts", "Bell"),
    L("/backup", "Backup", "DatabaseBackup"),
  ];

  if (actor.role === "SUPER_ADMIN") {
    return [
      L("/dashboard", "Dashboard", "LayoutDashboard"),
      L("/organizations", "Organizations", "Building2"),
      L("/branches", "Branches", "GitBranch"),
      ...CORE, ...SETUP,
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
      ...CORE, ...SETUP,
      { section: "Admin" },
      staff, roles, ...tail,
      L("/settings", scope.branchId ? "Branch Settings" : "Org Settings", "Settings"),
    ];
  }
  return [
    L("/branch/dashboard", "Dashboard", "LayoutDashboard"),
    ...CORE, ...SETUP,
    { section: "Admin" },
    staff, ...tail,
    L("/settings", "Settings", "Settings"),
  ];
}

export const flattenNav = (items) =>
  items.flatMap((i) => (i.children ? i.children : i.href ? [i] : []));

// Quick-access (+) actions. Only offered when the module is in the user's own navigation,
// so the menu can never expose something the role cannot open. The server still enforces access.
const QUICK = [
  ["/patients", "Add patient", "?new=1", "UserPlus"],
  ["/orders", "Walk-in patient", "?new=walkin", "Footprints"],
  ["/orders", "New test entry", "?new=1", "ClipboardList"],
  ["/billing", "Receive payment", "", "Receipt"],
  ["/expenses", "Add expense", "?new=1", "Wallet"],
  ["/tests", "Add test", "?new=1", "TestTube"],
  ["/doctors", "Add doctor", "?new=1", "Stethoscope"],
  ["/inventory", "Add stock item", "?new=1", "Boxes"],
  ["/staff", "Add staff", "?new=1", "UserCog"],
];

export function buildQuick(items) {
  const have = new Set(flattenNav(items).map((i) => i.href));
  return QUICK.filter(([href]) => have.has(href)).map(([href, label, q, icon]) => ({ href: `${href}${q}`, label, icon }));
}
