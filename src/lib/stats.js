import { prisma } from "@/lib/prisma";
import { scopeWhere, ADMIN_ROLE_NAMES } from "@/lib/scope";
import { startOfToday, daysAgo, dayKey } from "@/lib/time";

const n = (v) => (v == null ? 0 : Number(v));

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en", {
    month: "short",
    year: "2-digit",
  });
}

function getLastMonths(count = 6) {
  const now = new Date();
  const months = [];

  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(date);
    months.push({ key, label: monthLabel(key) });
  }

  return months;
}

/** Laboratory statistics for the current organization/branch/platform scope. */
export async function getLabStats(scope) {
  const base = scopeWhere(scope);
  const shared = scopeWhere(scope, { shared: true });
  const today = startOfToday();
  const live = { not: "CANCELLED" };
  const branchFilter = scope.branchId ? { id: scope.branchId } : {};
  const orgFilter = scope.organizationId
    ? { organizationId: scope.organizationId }
    : {};

  const [
    branchesTotal,
    branchesActive,
    staff,
    patients,
    patientsToday,
    tests,
    orders,
    ordersToday,
    reports,
    revenue,
    revenueToday,
    pendingSamples,
    pendingResults,
    expenses,
  ] = await Promise.all([
    prisma.branch.count({
      where: { ...orgFilter, ...branchFilter },
    }),
    prisma.branch.count({
      where: { ...orgFilter, ...branchFilter, status: "ACTIVE" },
    }),
    prisma.user.count({
      where: {
        ...orgFilter,
        ...(scope.branchId
          ? { memberships: { some: { branchId: scope.branchId } } }
          : {}),
        userRoles: {
          some: { role: { name: { notIn: ADMIN_ROLE_NAMES } } },
        },
        status: "ACTIVE",
      },
    }),
    prisma.patient.count({ where: base }),
    prisma.patient.count({
      where: { ...base, createdAt: { gte: today } },
    }),
    prisma.test.count({
      where: { AND: [shared, { isActive: true }] },
    }),
    prisma.labOrder.count({
      where: { ...base, status: live },
    }),
    prisma.labOrder.count({
      where: { ...base, status: live, createdAt: { gte: today } },
    }),
    prisma.labOrder.count({
      where: { ...base, status: "COMPLETED" },
    }),
    prisma.payment.aggregate({
      where: base,
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { ...base, createdAt: { gte: today } },
      _sum: { amount: true },
    }),
    prisma.sample.count({
      where: {
        status: "PENDING",
        order: { ...base, status: live },
      },
    }),
    prisma.labOrderItem.count({
      where: {
        resultStatus: { in: ["PENDING", "ENTERED"] },
        sample: { status: { in: ["COLLECTED", "RECEIVED"] } },
        order: {
          ...base,
          status: { notIn: ["CANCELLED", "COMPLETED"] },
        },
      },
    }),
    prisma.expense.aggregate({
      where: base,
      _sum: { amount: true },
    }),
  ]);

  return {
    branchesTotal,
    branchesActive,
    staff,
    patients,
    patientsToday,
    tests,
    orders,
    ordersToday,
    reports,
    revenue: n(revenue._sum.amount),
    revenueToday: n(revenueToday._sum.amount),
    pendingSamples,
    pendingResults,
    expenses: n(expenses._sum.amount),
  };
}

export async function getPlatformStats() {
  const [
    orgs,
    orgActive,
    orgSuspended,
    branches,
    branchesActive,
    users,
    patients,
    orders,
    revenue,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { status: "ACTIVE" } }),
    prisma.organization.count({ where: { status: "SUSPENDED" } }),
    prisma.branch.count(),
    prisma.branch.count({ where: { status: "ACTIVE" } }),
    prisma.user.count(),
    prisma.patient.count(),
    prisma.labOrder.count({
      where: { status: { not: "CANCELLED" } },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
    }),
  ]);

  return {
    orgs,
    orgActive,
    orgSuspended,
    branches,
    branchesActive,
    users,
    patients,
    orders,
    revenue: n(revenue._sum.amount),
  };
}

/**
 * Charts for Organization Admin and Branch Admin.
 * All queries use the current scope to prevent cross-organization
 * and cross-branch data exposure.
 */
export async function getDashboardCharts(scope) {
  const base = scopeWhere(scope);
  const since30Days = daysAgo(29);
  const months = getLastMonths(6);
  const firstMonth = new Date();
  firstMonth.setDate(1);
  firstMonth.setHours(0, 0, 0, 0);
  firstMonth.setMonth(firstMonth.getMonth() - 5);

  const [
    dailyOrders,
    dailyPayments,
    monthlyOrders,
    monthlyPayments,
    statusGroups,
    branchOrderGroups,
    branchPaymentGroups,
  ] = await Promise.all([
    prisma.labOrder.findMany({
      where: {
        ...base,
        status: { not: "CANCELLED" },
        createdAt: { gte: since30Days },
      },
      select: { createdAt: true },
    }),
    prisma.payment.findMany({
      where: {
        ...base,
        createdAt: { gte: since30Days },
      },
      select: { amount: true, createdAt: true },
    }),
    prisma.labOrder.findMany({
      where: {
        ...base,
        status: { not: "CANCELLED" },
        createdAt: { gte: firstMonth },
      },
      select: { createdAt: true },
    }),
    prisma.payment.findMany({
      where: {
        ...base,
        createdAt: { gte: firstMonth },
      },
      select: { amount: true, createdAt: true },
    }),
    prisma.labOrder.groupBy({
      by: ["status"],
      where: base,
      _count: { _all: true },
    }),
    scope.branchId
      ? Promise.resolve([])
      : prisma.labOrder.groupBy({
          by: ["branchId"],
          where: { ...base, status: { not: "CANCELLED" } },
          _count: { _all: true },
        }),
    scope.branchId
      ? Promise.resolve([])
      : prisma.payment.groupBy({
          by: ["branchId"],
          where: base,
          _sum: { amount: true },
        }),
  ]);

  const dailyMap = new Map();
  for (let i = 29; i >= 0; i--) {
    const date = daysAgo(i);
    dailyMap.set(dayKey(date), {
      date: dayKey(date),
      orders: 0,
      revenue: 0,
    });
  }

  for (const order of dailyOrders) {
    const key = dayKey(order.createdAt);
    if (dailyMap.has(key)) {
      dailyMap.get(key).orders += 1;
    }
  }

  for (const payment of dailyPayments) {
    const key = dayKey(payment.createdAt);
    if (dailyMap.has(key)) {
      dailyMap.get(key).revenue += n(payment.amount);
    }
  }

  const monthlyMap = new Map(
    months.map((month) => [
      month.key,
      {
        month: month.label,
        orders: 0,
        revenue: 0,
      },
    ]),
  );

  for (const order of monthlyOrders) {
    const key = monthKey(order.createdAt);
    if (monthlyMap.has(key)) {
      monthlyMap.get(key).orders += 1;
    }
  }

  for (const payment of monthlyPayments) {
    const key = monthKey(payment.createdAt);
    if (monthlyMap.has(key)) {
      monthlyMap.get(key).revenue += n(payment.amount);
    }
  }

  let branchRows = [];

  if (branchOrderGroups.length || branchPaymentGroups.length) {
    const ids = [
      ...new Set([
        ...branchOrderGroups.map((item) => item.branchId),
        ...branchPaymentGroups.map((item) => item.branchId),
      ]),
    ];

    const branches = await prisma.branch.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        organization: { select: { name: true } },
      },
    });

    branchRows = branches
      .map((branch) => ({
        id: branch.id,
        name: branch.name,
        organization: branch.organization.name,
        orders:
          branchOrderGroups.find((item) => item.branchId === branch.id)?._count
            ._all || 0,
        revenue: n(
          branchPaymentGroups.find((item) => item.branchId === branch.id)?._sum
            .amount,
        ),
      }))
      .sort((a, b) => b.orders - a.orders);
  }

  return {
    daily: [...dailyMap.values()],
    monthly: [...monthlyMap.values()],
    byStatus: statusGroups.map((item) => ({
      status: item.status,
      count: item._count._all,
    })),
    branchRows,
  };
}

/**
 * Platform-only charts for Super Admin.
 */
export async function getPlatformDashboardCharts() {
  const months = getLastMonths(6);
  const firstMonth = new Date();
  firstMonth.setDate(1);
  firstMonth.setHours(0, 0, 0, 0);
  firstMonth.setMonth(firstMonth.getMonth() - 5);

  const [organizations, organizationStatuses, orderGroups] = await Promise.all([
    prisma.organization.findMany({
      where: { createdAt: { gte: firstMonth } },
      select: { createdAt: true },
    }),
    prisma.organization.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.labOrder.groupBy({
      by: ["organizationId"],
      where: { status: { not: "CANCELLED" } },
      _count: { _all: true },
    }),
  ]);

  const growthMap = new Map(
    months.map((month) => [
      month.key,
      {
        month: month.label,
        organizations: 0,
      },
    ]),
  );

  for (const organization of organizations) {
    const key = monthKey(organization.createdAt);
    if (growthMap.has(key)) {
      growthMap.get(key).organizations += 1;
    }
  }

  const topIds = orderGroups
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 6)
    .map((item) => item.organizationId);

  const topOrganizations = topIds.length
    ? await prisma.organization.findMany({
        where: { id: { in: topIds } },
        select: { id: true, name: true, code: true },
      })
    : [];

  const topOrganizationRows = topOrganizations
    .map((organization) => ({
      ...organization,
      orders:
        orderGroups.find((item) => item.organizationId === organization.id)
          ?._count._all || 0,
    }))
    .sort((a, b) => b.orders - a.orders);

  return {
    organizationGrowth: [...growthMap.values()],
    organizationStatuses: organizationStatuses.map((item) => ({
      status: item.status,
      count: item._count._all,
    })),
    topOrganizations: topOrganizationRows,
  };
}

/** Existing analytics page data. */
export async function getAnalytics(scope) {
  const base = scopeWhere(scope);
  const since = daysAgo(29);
  const live = { not: "CANCELLED" };

  const [
    payments,
    topTests,
    byStatus,
    orderGroups,
    paymentGroups,
    expenseTotal,
    expensesByCategory,
  ] = await Promise.all([
    prisma.payment.findMany({
      where: { ...base, createdAt: { gte: since } },
      select: { amount: true, createdAt: true },
    }),
    prisma.labOrderItem.groupBy({
      by: ["testName"],
      where: { order: { ...base, status: live } },
      _count: { _all: true },
      _sum: { price: true },
      orderBy: { _count: { testName: "desc" } },
      take: 8,
    }),
    prisma.labOrder.groupBy({
      by: ["status"],
      where: base,
      _count: { _all: true },
    }),
    scope.branchId
      ? Promise.resolve([])
      : prisma.labOrder.groupBy({
          by: ["branchId"],
          where: { ...base, status: live },
          _count: { _all: true },
        }),
    scope.branchId
      ? Promise.resolve([])
      : prisma.payment.groupBy({
          by: ["branchId"],
          where: base,
          _sum: { amount: true },
        }),
    prisma.expense.aggregate({
      where: base,
      _sum: { amount: true },
    }),
    prisma.expense.groupBy({
      by: ["category"],
      where: base,
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 6,
    }),
  ]);

  const daily = new Map();
  for (let i = 29; i >= 0; i--) {
    daily.set(dayKey(daysAgo(i)), 0);
  }

  for (const payment of payments) {
    const key = dayKey(payment.createdAt);
    if (daily.has(key)) {
      daily.set(key, daily.get(key) + n(payment.amount));
    }
  }

  let branchRows = [];

  if (orderGroups.length || paymentGroups.length) {
    const ids = [
      ...new Set([
        ...orderGroups.map((item) => item.branchId),
        ...paymentGroups.map((item) => item.branchId),
      ]),
    ];

    const branches = await prisma.branch.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        organization: { select: { name: true } },
      },
    });

    branchRows = branches
      .map((branch) => ({
        id: branch.id,
        name: branch.name,
        organization: branch.organization.name,
        orders:
          orderGroups.find((item) => item.branchId === branch.id)?._count
            ._all || 0,
        revenue: n(
          paymentGroups.find((item) => item.branchId === branch.id)?._sum
            .amount,
        ),
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  return {
    daily: [...daily.entries()].map(([date, amount]) => ({
      date,
      amount,
    })),
    topTests: topTests.map((item) => ({
      name: item.testName,
      count: item._count._all,
      revenue: n(item._sum.price),
    })),
    byStatus: byStatus.map((item) => ({
      status: item.status,
      count: item._count._all,
    })),
    branchRows,
    expenseTotal: n(expenseTotal._sum.amount),
    expensesByCategory: expensesByCategory.map((item) => ({
      category: item.category,
      amount: n(item._sum.amount),
    })),
  };
}
