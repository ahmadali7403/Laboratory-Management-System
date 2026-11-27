import { prisma } from "@/lib/prisma";
import { scopeWhere } from "@/lib/scope";
import { startOfToday } from "@/lib/time";
import { round2 } from "@/lib/http";
import { daysFromTodayUtc, enrichMedicine, todayUtcDate } from "@/lib/pharmacy";
import { memo } from "@/lib/memo";

const n = (v) => (v == null ? 0 : Number(v));

export async function getPharmacyDashboard(scope) {
  return memo(`pharmacy:dash:${scope?.organizationId || "all"}:${scope?.branchId || "all"}`, 15_000, async () => {
    const base = scopeWhere(scope);
    const todayStart = startOfToday();
    const todayUtc = todayUtcDate();
    const near30Utc = daysFromTodayUtc(30);

    const [
      medicines,
      todaySalesAgg,
      todayPurchasesAgg,
      recentSales,
      recentPurchases,
      expiredBatches,
      nearExpiryBatches,
      supplierDueAgg,
    ] = await Promise.all([
      prisma.medicine.findMany({
        where: { ...base, status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          genericName: true,
          strength: true,
          unit: true,
          lowStockAlert: true,
          defaultPurchasePrice: true,
          defaultSalePrice: true,
          category: { select: { name: true } },
          company: { select: { name: true } },
          batches: {
            where: { isActive: true, quantity: { gt: 0 } },
            orderBy: { expiryDate: "asc" },
            select: {
              id: true,
              batchNumber: true,
              expiryDate: true,
              quantity: true,
              purchasePrice: true,
              salePrice: true,
              isActive: true,
            },
          },
        },
        orderBy: { name: "asc" },
        take: 2000,
      }),
      prisma.pharmacySale.aggregate({
        where: { ...base, status: { not: "CANCELLED" }, createdAt: { gte: todayStart } },
        _count: { _all: true },
        _sum: { total: true, paidAmount: true },
      }),
      prisma.pharmacyPurchase.aggregate({
        where: { ...base, status: "FINALIZED", finalizedAt: { gte: todayStart } },
        _count: { _all: true },
        _sum: { total: true },
      }),
      prisma.pharmacySale.findMany({
        where: base,
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          saleNo: true,
          customerName: true,
          total: true,
          paidAmount: true,
          paymentStatus: true,
          status: true,
          createdAt: true,
          branch: { select: { name: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.pharmacyPurchase.findMany({
        where: base,
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          purchaseNo: true,
          total: true,
          paidAmount: true,
          paymentStatus: true,
          status: true,
          createdAt: true,
          supplier: { select: { name: true } },
          branch: { select: { name: true } },
          _count: { select: { items: true } },
        },
      }),
    prisma.medicineBatch.findMany({
      where: { ...base, isActive: true, quantity: { gt: 0 }, expiryDate: { lt: todayUtc } },
      orderBy: { expiryDate: "asc" },
      take: 15,
      include: {
        medicine: { select: { id: true, name: true, genericName: true, strength: true, unit: true } },
        branch: { select: { name: true } },
      },
    }),
    prisma.medicineBatch.findMany({
      where: { ...base, isActive: true, quantity: { gt: 0 }, expiryDate: { gte: todayUtc, lte: near30Utc } },
      orderBy: { expiryDate: "asc" },
      take: 15,
      include: {
        medicine: { select: { id: true, name: true, genericName: true, strength: true, unit: true } },
        branch: { select: { name: true } },
      },
    }),
    prisma.supplier.aggregate({
      where: { ...scopeWhere(scope, { shared: true }), isActive: true },
      _sum: { pharmacyBalance: true },
    }),
  ]);

  const enriched = medicines.map((m) => enrichMedicine(m));
  let totalStockValue = 0;
  let totalRetailValue = 0;
  const lowStockList = [];

  for (const m of enriched) {
    totalStockValue += m.stockValue;
    for (const b of m.batches || []) {
      totalRetailValue += n(b.quantity) * n(b.salePrice);
    }
    if (m.stockStatus === "LOW" || m.stockStatus === "OUT") {
      lowStockList.push({
        id: m.id,
        name: m.name,
        genericName: m.genericName,
        strength: m.strength,
        unit: m.unit,
        validStock: m.validStock,
        lowStockAlert: n(m.lowStockAlert),
        stockStatus: m.stockStatus,
        category: m.category?.name || null,
      });
    }
  }

  const [expiredCount, nearExpiryCount] = await Promise.all([
    prisma.medicineBatch.count({
      where: { ...base, isActive: true, quantity: { gt: 0 }, expiryDate: { lt: todayUtc } },
    }),
    prisma.medicineBatch.count({
      where: { ...base, isActive: true, quantity: { gt: 0 }, expiryDate: { gte: todayUtc, lte: near30Utc } },
    }),
  ]);

  return {
    stats: {
      totalMedicines: medicines.length,
      totalStockValue: round2(totalStockValue),
      totalRetailValue: round2(totalRetailValue),
      todaySalesCount: todaySalesAgg._count._all,
      todaySalesTotal: round2(n(todaySalesAgg._sum.total)),
      todaySalesCollected: round2(n(todaySalesAgg._sum.paidAmount)),
      todayPurchasesCount: todayPurchasesAgg._count._all,
      todayPurchasesTotal: round2(n(todayPurchasesAgg._sum.total)),
      lowStockCount: lowStockList.filter((x) => x.stockStatus === "LOW").length,
      outOfStockCount: lowStockList.filter((x) => x.stockStatus === "OUT").length,
      nearExpiryCount,
      expiredCount,
      supplierPayable: round2(n(supplierDueAgg._sum.pharmacyBalance)),
    },
    lowStockMedicines: lowStockList.slice(0, 12),
    nearExpiryBatches,
    expiredBatches,
    recentSales,
    recentPurchases,
  };
  });
}
