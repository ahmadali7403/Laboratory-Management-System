import { prisma } from "@/lib/prisma";
import { scopeWhere, ADMIN_ROLE_NAMES } from "@/lib/scope";
import { startOfToday, daysAgo, dayKey } from "@/lib/time";

const n = (v) => (v == null ? 0 : Number(v));

/** Laboratory statistics for whatever slice the current scope selects. */
export async function getLabStats(scope) {
  const base = scopeWhere(scope);
  const shared = scopeWhere(scope, { shared: true });
  const today = startOfToday();
  const live = { not: "CANCELLED" };
  const branchFilter = scope.branchId ? { id: scope.branchId } : {};
  const orgFilter = scope.organizationId ? { organizationId: scope.organizationId } : {};

  const [
    branchesTotal, branchesActive, staff, patients, patientsToday, tests,
    orders, ordersToday, reports, revenue, revenueToday, pendingSamples, pendingResults, expenses,
  ] = await Promise.all([
    prisma.branch.count({ where: { ...orgFilter, ...branchFilter } }),
    prisma.branch.count({ where: { ...orgFilter, ...branchFilter, status: "ACTIVE" } }),
    prisma.user.count({
      where: {
        ...orgFilter,
        ...(scope.branchId ? { memberships: { some: { branchId: scope.branchId } } } : {}),
        userRoles: { some: { role: { name: { notIn: ADMIN_ROLE_NAMES } } } },
        status: "ACTIVE",
      },
    }),
    prisma.patient.count({ where: base }),
    prisma.patient.count({ where: { ...base, createdAt: { gte: today } } }),
    prisma.test.count({ where: { AND: [shared, { isActive: true }] } }),
    prisma.labOrder.count({ where: { ...base, status: live } }),
    prisma.labOrder.count({ where: { ...base, status: live, createdAt: { gte: today } } }),
    prisma.labOrder.count({ where: { ...base, status: "COMPLETED" } }),
    prisma.payment.aggregate({ where: base, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { ...base, createdAt: { gte: today } }, _sum: { amount: true } }),
    prisma.sample.count({ where: { status: "PENDING", order: { ...base, status: live } } }),
    prisma.labOrderItem.count({
      where: {
        resultStatus: { in: ["PENDING", "ENTERED"] },
        sample: { status: { in: ["COLLECTED", "RECEIVED"] } },
        order: { ...base, status: { notIn: ["CANCELLED", "COMPLETED"] } },
      },
    }),
    prisma.expense.aggregate({ where: base, _sum: { amount: true } }),
  ]);

  return {
    branchesTotal, branchesActive, staff, patients, patientsToday, tests,
    orders, ordersToday, reports,
    revenue: n(revenue._sum.amount), revenueToday: n(revenueToday._sum.amount),
    pendingSamples, pendingResults, expenses: n(expenses._sum.amount),
  };
}

export async function getPlatformStats() {
  const [orgs, orgActive, orgSuspended, branches, branchesActive, users, patients, orders, revenue] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { status: "ACTIVE" } }),
    prisma.organization.count({ where: { status: "SUSPENDED" } }),
    prisma.branch.count(),
    prisma.branch.count({ where: { status: "ACTIVE" } }),
    prisma.user.count(),
    prisma.patient.count(),
    prisma.labOrder.count({ where: { status: { not: "CANCELLED" } } }),
    prisma.payment.aggregate({ _sum: { amount: true } }),
  ]);
  return {
    orgs, orgActive, orgSuspended, branches, branchesActive, users, patients, orders,
    revenue: n(revenue._sum.amount),
  };
}

export async function getAnalytics(scope) {
  const base = scopeWhere(scope);
  const since = daysAgo(29);
  const live = { not: "CANCELLED" };

  const [payments, topTests, byStatus, orderGroups, paymentGroups, expenseTotal, expensesByCategory] = await Promise.all([
    prisma.payment.findMany({ where: { ...base, createdAt: { gte: since } }, select: { amount: true, createdAt: true } }),
    prisma.labOrderItem.groupBy({
      by: ["testName"],
      where: { order: { ...base, status: live } },
      _count: { _all: true },
      _sum: { price: true },
      orderBy: { _count: { testName: "desc" } },
      take: 8,
    }),
    prisma.labOrder.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
    scope.branchId ? Promise.resolve([]) : prisma.labOrder.groupBy({ by: ["branchId"], where: { ...base, status: live }, _count: { _all: true } }),
    scope.branchId ? Promise.resolve([]) : prisma.payment.groupBy({ by: ["branchId"], where: base, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: base, _sum: { amount: true } }),
    prisma.expense.groupBy({ by: ["category"], where: base, _sum: { amount: true }, orderBy: { _sum: { amount: "desc" } }, take: 6 }),
  ]);

  const daily = new Map();
  for (let i = 29; i >= 0; i--) daily.set(dayKey(daysAgo(i)), 0);
  for (const p of payments) {
    const k = dayKey(p.createdAt);
    if (daily.has(k)) daily.set(k, daily.get(k) + n(p.amount));
  }

  let branchRows = [];
  if (orderGroups.length || paymentGroups.length) {
    const ids = [...new Set([...orderGroups.map((g) => g.branchId), ...paymentGroups.map((g) => g.branchId)])];
    const names = await prisma.branch.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, organization: { select: { name: true } } } });
    branchRows = names.map((b) => ({
      id: b.id,
      name: b.name,
      organization: b.organization.name,
      orders: orderGroups.find((g) => g.branchId === b.id)?._count._all || 0,
      revenue: n(paymentGroups.find((g) => g.branchId === b.id)?._sum.amount),
    })).sort((a, b) => b.revenue - a.revenue);
  }

  return {
    daily: [...daily.entries()].map(([date, amount]) => ({ date, amount })),
    topTests: topTests.map((t) => ({ name: t.testName, count: t._count._all, revenue: n(t._sum.price) })),
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
    branchRows,
    expenseTotal: n(expenseTotal._sum.amount),
    expensesByCategory: expensesByCategory.map((e) => ({ category: e.category, amount: n(e._sum.amount) })),
  };
}
