import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { scopeWhere, ADMIN_ROLE_NAMES } from "@/lib/scope";
import { startOfToday, daysAgo, dayKey, LAB_TZ } from "@/lib/time";
import { memo, invalidateStatsCache } from "@/lib/memo";

export { invalidateStatsCache };

const n = (v) => (v == null ? 0 : Number(v));

function scopeKey(scope) {
  return `${scope?.organizationId || "all"}:${scope?.branchId || "all"}`;
}

function monthKey(date) {
  return dayKey(date).slice(0, 7);
}

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en", {
    month: "short",
    year: "2-digit",
  });
}

function getLastMonths(count = 6) {
  const [nowY, nowM] = dayKey(new Date()).split("-").map(Number);
  const months = [];

  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(nowY, nowM - 1 - i, 1);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const key = `${y}-${m}`;
    months.push({ key, label: monthLabel(key) });
  }

  return months;
}

function firstMonthStart(count = 6) {
  const [nowY, nowM] = dayKey(new Date()).split("-").map(Number);
  const first = new Date(nowY, nowM - count, 1);
  const y = first.getFullYear();
  const m = String(first.getMonth() + 1).padStart(2, "0");
  return new Date(`${y}-${m}-01T00:00:00+05:00`);
}

function sqlScopeFilter(scope) {
  const orgSql = scope?.organizationId
    ? Prisma.sql`AND "organizationId" = ${scope.organizationId}::uuid`
    : Prisma.empty;
  const branchSql = scope?.branchId
    ? Prisma.sql`AND "branchId" = ${scope.branchId}::uuid`
    : Prisma.empty;
  return Prisma.sql`${orgSql} ${branchSql}`;
}

/** Laboratory statistics for the current organization/branch/platform scope. */
export async function getLabStats(scope) {
  return memo(`stats:lab:${scopeKey(scope)}`, 15_000, async () => {
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
  });
}

export async function getPlatformStats() {
  return memo("stats:platform", 15_000, async () => {
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
      prisma.labOrder.count({ where: { status: { not: "CANCELLED" } } }),
      prisma.payment.aggregate({ _sum: { amount: true } }),
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
  });
}

/**
 * Charts for Organization Admin and Branch Admin.
 * Uses SQL date bucketing in Asia/Karachi so large tables do not pull raw rows into Node.
 */
export async function getDashboardCharts(scope) {
  return memo(`stats:charts:${scopeKey(scope)}`, 20_000, async () => {
    const base = scopeWhere(scope);
    const since30Days = daysAgo(29);
    const months = getLastMonths(6);
    const firstMonth = firstMonthStart(6);
    const scopeSql = sqlScopeFilter(scope);

    const [
      dailyOrders,
      dailyPayments,
      monthlyOrders,
      monthlyPayments,
      statusGroups,
      branchOrderGroups,
      branchPaymentGroups,
    ] = await Promise.all([
      prisma.$queryRaw`
        SELECT to_char(("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${LAB_TZ}), 'YYYY-MM-DD') AS day,
               COUNT(*)::int AS cnt
        FROM "LabOrder"
        WHERE "status" <> 'CANCELLED' AND "createdAt" >= ${since30Days} ${scopeSql}
        GROUP BY 1
      `,
      prisma.$queryRaw`
        SELECT to_char(("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${LAB_TZ}), 'YYYY-MM-DD') AS day,
               COALESCE(SUM("amount"), 0)::float8 AS total
        FROM "Payment"
        WHERE "createdAt" >= ${since30Days} ${scopeSql}
        GROUP BY 1
      `,
      prisma.$queryRaw`
        SELECT to_char(("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${LAB_TZ}), 'YYYY-MM') AS ym,
               COUNT(*)::int AS cnt
        FROM "LabOrder"
        WHERE "status" <> 'CANCELLED' AND "createdAt" >= ${firstMonth} ${scopeSql}
        GROUP BY 1
      `,
      prisma.$queryRaw`
        SELECT to_char(("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${LAB_TZ}), 'YYYY-MM') AS ym,
               COALESCE(SUM("amount"), 0)::float8 AS total
        FROM "Payment"
        WHERE "createdAt" >= ${firstMonth} ${scopeSql}
        GROUP BY 1
      `,
      prisma.labOrder.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
      scope.branchId
        ? Promise.resolve([])
        : prisma.labOrder.groupBy({ by: ["branchId"], where: { ...base, status: { not: "CANCELLED" } }, _count: { _all: true } }),
      scope.branchId
        ? Promise.resolve([])
        : prisma.payment.groupBy({ by: ["branchId"], where: base, _sum: { amount: true } }),
    ]);

    const dailyMap = new Map();
    for (let i = 29; i >= 0; i--) {
      const date = daysAgo(i);
      const key = dayKey(date);
      dailyMap.set(key, { date: key, orders: 0, revenue: 0 });
    }
    for (const row of dailyOrders) {
      if (dailyMap.has(row.day)) dailyMap.get(row.day).orders = Number(row.cnt || 0);
    }
    for (const row of dailyPayments) {
      if (dailyMap.has(row.day)) dailyMap.get(row.day).revenue = Number(row.total || 0);
    }

    const monthlyMap = new Map(
      months.map((month) => [month.key, { month: month.label, orders: 0, revenue: 0 }]),
    );
    for (const row of monthlyOrders) {
      if (monthlyMap.has(row.ym)) monthlyMap.get(row.ym).orders = Number(row.cnt || 0);
    }
    for (const row of monthlyPayments) {
      if (monthlyMap.has(row.ym)) monthlyMap.get(row.ym).revenue = Number(row.total || 0);
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
        select: { id: true, name: true, organization: { select: { name: true } } },
      });
      const orderByBranch = new Map(branchOrderGroups.map((item) => [item.branchId, item._count._all]));
      const payByBranch = new Map(branchPaymentGroups.map((item) => [item.branchId, n(item._sum.amount)]));
      branchRows = branches
        .map((branch) => ({
          id: branch.id,
          name: branch.name,
          organization: branch.organization.name,
          orders: orderByBranch.get(branch.id) || 0,
          revenue: payByBranch.get(branch.id) || 0,
        }))
        .sort((a, b) => b.orders - a.orders);
    }

    return {
      daily: [...dailyMap.values()],
      monthly: [...monthlyMap.values()],
      byStatus: statusGroups.map((item) => ({ status: item.status, count: item._count._all })),
      branchRows,
    };
  });
}

/** Platform-only charts for Super Admin. */
export async function getPlatformDashboardCharts() {
  return memo("stats:platform-charts", 20_000, async () => {
    const months = getLastMonths(6);
    const firstMonth = firstMonthStart(6);

    const [orgMonthly, organizationStatuses, orderGroups] = await Promise.all([
      prisma.$queryRaw`
        SELECT to_char(("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${LAB_TZ}), 'YYYY-MM') AS ym,
               COUNT(*)::int AS cnt
        FROM "Organization"
        WHERE "createdAt" >= ${firstMonth}
        GROUP BY 1
      `,
      prisma.organization.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.labOrder.groupBy({
        by: ["organizationId"],
        where: { status: { not: "CANCELLED" } },
        _count: { _all: true },
      }),
    ]);

    const growthMap = new Map(
      months.map((month) => [month.key, { month: month.label, organizations: 0 }]),
    );
    for (const row of orgMonthly) {
      if (growthMap.has(row.ym)) growthMap.get(row.ym).organizations = Number(row.cnt || 0);
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

    const countByOrg = new Map(orderGroups.map((item) => [item.organizationId, item._count._all]));
    const topOrganizationRows = topOrganizations
      .map((organization) => ({
        ...organization,
        orders: countByOrg.get(organization.id) || 0,
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
  });
}

/** Existing analytics page data. */
export async function getAnalytics(scope) {
  return memo(`stats:analytics:${scopeKey(scope)}`, 20_000, async () => {
    const base = scopeWhere(scope);
    const since = daysAgo(29);
    const live = { not: "CANCELLED" };
    const scopeSql = sqlScopeFilter(scope);

    const [
      dailyPayments,
      topTests,
      byStatus,
      orderGroups,
      paymentGroups,
      expenseTotal,
      expensesByCategory,
    ] = await Promise.all([
      prisma.$queryRaw`
        SELECT to_char(("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${LAB_TZ}), 'YYYY-MM-DD') AS day,
               COALESCE(SUM("amount"), 0)::float8 AS total
        FROM "Payment"
        WHERE "createdAt" >= ${since} ${scopeSql}
        GROUP BY 1
      `,
      prisma.labOrderItem.groupBy({
        by: ["testName"],
        where: { order: { ...base, status: live } },
        _count: { _all: true },
        _sum: { price: true },
        orderBy: { _count: { testName: "desc" } },
        take: 8,
      }),
      prisma.labOrder.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
      scope.branchId
        ? Promise.resolve([])
        : prisma.labOrder.groupBy({ by: ["branchId"], where: { ...base, status: live }, _count: { _all: true } }),
      scope.branchId
        ? Promise.resolve([])
        : prisma.payment.groupBy({ by: ["branchId"], where: base, _sum: { amount: true } }),
      prisma.expense.aggregate({ where: base, _sum: { amount: true } }),
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
    for (const row of dailyPayments) {
      if (daily.has(row.day)) daily.set(row.day, Number(row.total || 0));
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
        select: { id: true, name: true, organization: { select: { name: true } } },
      });
      const orderByBranch = new Map(orderGroups.map((item) => [item.branchId, item._count._all]));
      const payByBranch = new Map(paymentGroups.map((item) => [item.branchId, n(item._sum.amount)]));
      branchRows = branches
        .map((branch) => ({
          id: branch.id,
          name: branch.name,
          organization: branch.organization.name,
          orders: orderByBranch.get(branch.id) || 0,
          revenue: payByBranch.get(branch.id) || 0,
        }))
        .sort((a, b) => b.revenue - a.revenue);
    }

    return {
      daily: [...daily.entries()].map(([date, amount]) => ({ date, amount })),
      topTests: topTests.map((item) => ({
        name: item.testName,
        count: item._count._all,
        revenue: n(item._sum.price),
      })),
      byStatus: byStatus.map((item) => ({ status: item.status, count: item._count._all })),
      branchRows,
      expenseTotal: n(expenseTotal._sum.amount),
      expensesByCategory: expensesByCategory.map((item) => ({
        category: item.category,
        amount: n(item._sum.amount),
      })),
    };
  });
}

void monthKey;
