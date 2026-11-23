// Navigation is derived on the server from the authenticated role only.
const LAB = (extra = {}) => [
  { href: "/patients", label: "Patients", icon: "Users" },
  { href: "/doctors", label: "Doctors", icon: "Stethoscope" },
  { href: "/tests", label: "Test Catalog", icon: "TestTube" },
  { href: "/orders", label: "Laboratory Orders", icon: "ClipboardList" },
  { href: "/samples", label: extra.samples || "Sample Collection", icon: "Droplets" },
  { href: "/results", label: "Results", icon: "FlaskConical" },
  { href: "/reports", label: "Reports", icon: "FileText" },
  { href: "/billing", label: "Billing & Payments", icon: "Receipt" },
  { href: "/expenses", label: "Expenses", icon: "Wallet" },
  { href: "/inventory", label: "Inventory", icon: "Boxes" },
  { href: "/suppliers", label: "Suppliers", icon: "Truck" },
  { href: "/purchases", label: "Purchases", icon: "ShoppingCart" },
];

export function buildNav({ actor, scope }) {
  const staff = { href: "/staff", label: "Staff Management", icon: "UserCog" };
  const roles = { href: "/roles", label: "Roles & Permissions", icon: "ShieldCheck" };
  const tail = [
    { href: "/analytics", label: "Reports & Analytics", icon: "BarChart3" },
    { href: "/notifications", label: "Notifications", icon: "Bell" },
    { href: "/backup", label: "Backup & Restore", icon: "DatabaseBackup" },
  ];

  if (actor.role === "SUPER_ADMIN") {
    return [
      { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
      { href: "/organizations", label: "Organizations", icon: "Building2" },
      { href: "/branches", label: "All Branches", icon: "GitBranch" },
      { section: "Laboratory data" },
      staff, roles, ...LAB(), ...tail,
      { section: "Platform" },
      ...(scope.organizationId ? [{ href: "/settings", label: scope.branchId ? "Branch Settings" : "Organization Settings", icon: "Settings" }] : []),
      { href: "/platform-settings", label: "Platform Settings", icon: "SlidersHorizontal" },
    ];
  }
  if (actor.role === "ORGANIZATION_ADMIN") {
    return [
      { href: "/organization/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
      { href: `/organizations/${actor.organizationId}/branches`, label: "Branch Management", icon: "GitBranch" },
      staff, roles, ...LAB(), ...tail,
      { href: "/settings", label: scope.branchId ? "Branch Settings" : "Organization Settings", icon: "Settings" },
    ];
  }
  return [
    { href: "/branch/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    staff, ...LAB({ samples: "Sample Collection" }), ...tail,
    { href: "/settings", label: "Branch Settings", icon: "Settings" },
  ];
}
