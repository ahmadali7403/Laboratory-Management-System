import { prisma } from "@/lib/prisma";
import { apiContext, scopeWhere } from "@/lib/scope";
import { handleError, json } from "@/lib/http";
import { daysFromTodayUtc, enrichMedicine, todayUtcDate } from "@/lib/pharmacy";

export async function GET(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const base = scopeWhere(auth.ctx.scope);
    const todayUtc = todayUtcDate();
    const near30 = daysFromTodayUtc(30);
    const near90 = daysFromTodayUtc(90);

    const [medicines, batches] = await Promise.all([
      prisma.medicine.findMany({
        where: { ...base, status: "ACTIVE" },
        orderBy: { name: "asc" },
        take: 2000,
        include: {
          branch: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          company: { select: { id: true, name: true } },
          defaultSupplier: { select: { id: true, name: true } },
          batches: { where: { isActive: true, quantity: { gt: 0 } }, orderBy: { expiryDate: "asc" } },
        },
      }),
      prisma.medicineBatch.findMany({
        where: { ...base, isActive: true, quantity: { gt: 0 }, expiryDate: { lte: near90 } },
        orderBy: { expiryDate: "asc" },
        take: 1000,
        include: {
          branch: { select: { id: true, name: true } },
          medicine: { select: { id: true, name: true, genericName: true, strength: true, unit: true } },
          supplier: { select: { id: true, name: true } },
        },
      }),
    ]);

    const lowStock = medicines
      .map((m) => enrichMedicine(m))
      .filter((m) => m.stockStatus === "LOW" || m.stockStatus === "OUT");

    const expired = [];
    const expiring30 = [];
    const expiring90 = [];
    for (const b of batches) {
      const exp = new Date(b.expiryDate);
      if (exp < todayUtc) expired.push(b);
      else if (exp <= near30) expiring30.push(b);
      else expiring90.push(b);
    }

    return json({ lowStock, expired, expiring30, expiring90 });
  } catch (error) {
    return handleError(error, "Pharmacy alerts");
  }
}
