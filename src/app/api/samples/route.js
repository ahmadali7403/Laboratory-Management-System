import { prisma } from "@/lib/prisma";
import { apiContext, scopeWhere } from "@/lib/scope";
import { handleError, json, paging } from "@/lib/http";

export async function GET(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const sp = new URL(request.url).searchParams;
    const { page, pageSize, skip, take } = paging(sp);
    const q = (sp.get("q") || "").trim().slice(0, 100);
    const status = sp.get("status");

    const and = [{ order: { AND: [scopeWhere(auth.ctx.scope), { status: { not: "CANCELLED" } }] } }];
    if (["PENDING", "COLLECTED", "RECEIVED", "REJECTED"].includes(status)) and.push({ status });
    if (q) {
      and.push({
        OR: [
          { sampleNo: { contains: q, mode: "insensitive" } },
          { order: { orderNo: { contains: q, mode: "insensitive" } } },
          { order: { patient: { name: { contains: q, mode: "insensitive" } } } },
          { order: { patient: { mrn: { contains: q, mode: "insensitive" } } } },
        ],
      });
    }
    const where = { AND: and };
    const [items, total] = await Promise.all([
      prisma.sample.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          order: { select: { id: true, orderNo: true, branch: { select: { name: true } }, patient: { select: { name: true, mrn: true } } } },
          items: { select: { testName: true } },
        },
      }),
      prisma.sample.count({ where }),
    ]);
    return json({ items, total, page, pageSize });
  } catch (error) {
    return handleError(error, "Samples list");
  }
}
