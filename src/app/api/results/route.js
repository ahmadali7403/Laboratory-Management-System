import { prisma } from "@/lib/prisma";
import { apiContext, scopeWhere } from "@/lib/scope";
import { handleError, json, paging } from "@/lib/http";

/** Result worklist: tests whose sample has been collected/received. */
export async function GET(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const sp = new URL(request.url).searchParams;
    const { page, pageSize, skip, take } = paging(sp);
    const q = (sp.get("q") || "").trim().slice(0, 100);
    const status = sp.get("status");

    const and = [
      { order: { AND: [scopeWhere(auth.ctx.scope), { status: { not: "CANCELLED" } }] } },
      { sample: { status: { in: ["COLLECTED", "RECEIVED"] } } },
    ];
    if (["PENDING", "ENTERED", "VERIFIED"].includes(status)) and.push({ resultStatus: status });
    if (q) {
      and.push({
        OR: [
          { testName: { contains: q, mode: "insensitive" } },
          { order: { orderNo: { contains: q, mode: "insensitive" } } },
          { order: { patient: { name: { contains: q, mode: "insensitive" } } } },
          { order: { patient: { mrn: { contains: q, mode: "insensitive" } } } },
        ],
      });
    }
    const where = { AND: and };
    const [items, total] = await Promise.all([
      prisma.labOrderItem.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          order: { select: { id: true, orderNo: true, branch: { select: { name: true } }, patient: { select: { name: true, mrn: true, gender: true, dateOfBirth: true } } } },
          test: { select: { refLow: true, refHigh: true, refRangeText: true, unit: true } },
        },
      }),
      prisma.labOrderItem.count({ where }),
    ]);
    return json({ items, total, page, pageSize });
  } catch (error) {
    return handleError(error, "Results list");
  }
}
