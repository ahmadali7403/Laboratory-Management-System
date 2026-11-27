import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiContext, resolveWriteTarget, scopeWhere } from "@/lib/scope";
import { fail, handleError, json, money, opt, optUuid, parseBody, round2 } from "@/lib/http";
import { hasModule } from "@/lib/permissions";
import { clientIp, logAudit } from "@/lib/audit";

export async function GET(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const { actor, scope } = auth.ctx;
    const sp = new URL(request.url).searchParams;
    const branchFilter = sp.get("branchId");
    const isManager =
      actor.role !== "STAFF" ||
      hasModule(actor.permissions, "pharmacy") ||
      hasModule(actor.permissions, "pharmacy_reports");

    const where = {
      ...scopeWhere(scope),
      ...(branchFilter ? { branchId: branchFilter } : {}),
      ...(isManager ? {} : { userId: actor.id }),
    };

    const [openShift, recentShifts] = await Promise.all([
      prisma.pharmacyShift.findFirst({
        where: {
          ...scopeWhere(scope),
          ...(branchFilter ? { branchId: branchFilter } : {}),
          userId: actor.role === "SUPER_ADMIN" ? undefined : actor.id,
          status: "OPEN",
        },
        orderBy: { openedAt: "desc" },
      }),
      prisma.pharmacyShift.findMany({
        where,
        orderBy: { openedAt: "desc" },
        take: 15,
        include: { branch: { select: { name: true } } },
      }),
    ]);

    // Compute live totals for the active open shift since openedAt
    let liveSummary = null;
    if (openShift) {
      const sales = await prisma.pharmacySale.findMany({
        where: {
          branchId: openShift.branchId,
          soldByName: openShift.cashierName,
          status: { not: "CANCELLED" },
          createdAt: { gte: openShift.openedAt },
        },
        select: {
          total: true,
          payments: { select: { amount: true, method: true } },
        },
      });
      let cashSales = 0;
      let cardSales = 0;
      let mobileSales = 0;
      let bankSales = 0;
      let totalSales = 0;
      for (const s of sales) {
        totalSales = round2(totalSales + Number(s.total || 0));
        for (const p of s.payments || []) {
          const amt = Number(p.amount || 0);
          if (p.method === "CASH") cashSales = round2(cashSales + amt);
          else if (p.method === "CARD") cardSales = round2(cardSales + amt);
          else if (p.method === "JAZZCASH" || p.method === "EASYPAISA") mobileSales = round2(mobileSales + amt);
          else bankSales = round2(bankSales + amt);
        }
      }
      liveSummary = {
        salesCount: sales.length,
        totalSales,
        cashSales,
        cardSales,
        mobileSales,
        bankSales,
        expectedCash: round2(Number(openShift.openingCash) + cashSales),
      };
    }

    return json({ openShift, liveSummary, recentShifts });
  } catch (error) {
    return handleError(error, "Pharmacy shifts list");
  }
}

const openSchema = z.object({
  branchId: optUuid,
  openingCash: money.default(0),
  notes: opt(300),
});

export async function POST(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const { actor } = auth.ctx;
    if (actor.role === "SUPER_ADMIN") {
      return fail("Switch to an organization/branch staff account to open a cashier shift.", 400);
    }
    const parsed = await parseBody(request, openSchema);
    if (parsed.error) return parsed.error;
    const resolved = await resolveWriteTarget(auth.ctx, parsed.data, { branchRequired: true });
    if (resolved.error) return resolved.error;
    const { organizationId, branchId } = resolved.target;

    const existingOpen = await prisma.pharmacyShift.findFirst({
      where: { userId: actor.id, branchId, status: "OPEN" },
    });
    if (existingOpen) return fail("You already have an open shift in this branch.", 409);

    const shift = await prisma.pharmacyShift.create({
      data: {
        organizationId,
        branchId,
        userId: actor.id,
        cashierName: actor.name,
        openingCash: round2(parsed.data.openingCash),
        notes: parsed.data.notes,
      },
    });

    await logAudit({
      organizationId,
      branchId,
      userId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: "SHIFT_OPEN",
      resource: "PHARMACY_SHIFT",
      resourceId: shift.id,
      summary: `${actor.name} opened shift with Rs. ${round2(parsed.data.openingCash)}`,
      ip: clientIp(request),
    });

    return json({ shift, message: "Shift opened." }, 201);
  } catch (error) {
    return handleError(error, "Shift open");
  }
}

const closeSchema = z.object({
  closingCash: money,
  notes: opt(300),
});

export async function PATCH(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const { actor } = auth.ctx;
    const parsed = await parseBody(request, closeSchema);
    if (parsed.error) return parsed.error;

    const openShift = await prisma.pharmacyShift.findFirst({
      where: { userId: actor.id, status: "OPEN", ...(actor.branchId ? { branchId: actor.branchId } : {}) },
      orderBy: { openedAt: "desc" },
    });
    if (!openShift) return fail("No open shift found.", 404);

    const sales = await prisma.pharmacySale.findMany({
      where: {
        branchId: openShift.branchId,
        soldByName: openShift.cashierName,
        status: { not: "CANCELLED" },
        createdAt: { gte: openShift.openedAt },
      },
      select: { total: true, payments: { select: { amount: true, method: true } } },
    });

    let cashSales = 0;
    let cardSales = 0;
    let mobileSales = 0;
    let bankSales = 0;
    let totalSales = 0;
    for (const s of sales) {
      totalSales = round2(totalSales + Number(s.total || 0));
      for (const p of s.payments || []) {
        const amt = Number(p.amount || 0);
        if (p.method === "CASH") cashSales = round2(cashSales + amt);
        else if (p.method === "CARD") cardSales = round2(cardSales + amt);
        else if (p.method === "JAZZCASH" || p.method === "EASYPAISA") mobileSales = round2(mobileSales + amt);
        else bankSales = round2(bankSales + amt);
      }
    }
    const expectedCash = round2(Number(openShift.openingCash) + cashSales);
    const closingCash = round2(parsed.data.closingCash);

    const closed = await prisma.pharmacyShift.update({
      where: { id: openShift.id },
      data: {
        status: "CLOSED",
        closingCash,
        expectedCash,
        totalSales,
        cashSales,
        cardSales,
        mobileSales,
        bankSales,
        salesCount: sales.length,
        notes: parsed.data.notes || openShift.notes,
        closedAt: new Date(),
      },
    });

    await logAudit({
      organizationId: openShift.organizationId,
      branchId: openShift.branchId,
      userId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: "SHIFT_CLOSE",
      resource: "PHARMACY_SHIFT",
      resourceId: closed.id,
      summary: `${actor.name} closed shift · Expected Rs. ${expectedCash}, Counted Rs. ${closingCash}`,
      ip: clientIp(request),
    });

    return json({ shift: closed, message: "Shift closed." });
  } catch (error) {
    return handleError(error, "Shift close");
  }
}
