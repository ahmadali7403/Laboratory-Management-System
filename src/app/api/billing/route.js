import { prisma } from "@/lib/prisma";
import { apiContext, scopeWhere } from "@/lib/scope";
import { handleError, json, paging } from "@/lib/http";

/** GET /api/billing?view=payments  -> payment ledger (invoices are /api/orders) */
export async function GET(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const sp = new URL(request.url).searchParams;
    const { page, pageSize, skip, take } = paging(sp);
    const q = (sp.get("q") || "").trim().slice(0, 100);
    const method = sp.get("method");

    const and = [scopeWhere(auth.ctx.scope)];
    if (["CASH", "CARD", "BANK_TRANSFER", "ONLINE"].includes(method)) and.push({ method });
    if (q) {
      and.push({
        OR: [
          { order: { orderNo: { contains: q, mode: "insensitive" } } },
          { order: { patient: { name: { contains: q, mode: "insensitive" } } } },
          { reference: { contains: q, mode: "insensitive" } },
        ],
      });
    }
    const where = { AND: and };
    const [items, total, sum] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          order: { select: { id: true, orderNo: true, patient: { select: { name: true } } } },
          branch: { select: { id: true, name: true } },
        },
      }),
      prisma.payment.count({ where }),
      prisma.payment.aggregate({ where, _sum: { amount: true } }),
    ]);
    return json({ items, total, page, pageSize, totalAmount: sum._sum.amount });
  } catch (error) {
    return handleError(error, "Payments list");
  }
}
