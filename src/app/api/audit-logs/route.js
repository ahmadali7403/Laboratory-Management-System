import { prisma } from "@/lib/prisma";
import { apiContext, scopeWhere } from "@/lib/scope";
import { handleError, json, paging } from "@/lib/http";

export async function GET(request) {
  try {
    const auth = await apiContext(request, {
      roles: ["SUPER_ADMIN", "ORGANIZATION_ADMIN", "BRANCH_ADMIN"],
    });
    if (auth.error) return auth.error;

    const sp = new URL(request.url).searchParams;
    const { page, pageSize, skip, take } = paging(sp, 30);
    const q = (sp.get("q") || "").trim().slice(0, 80);
    const action = (sp.get("action") || "").trim().slice(0, 60);

    const and = [scopeWhere(auth.ctx.scope, { shared: true })];
    if (action) and.push({ action });
    if (q) {
      and.push({
        OR: [
          { actorName: { contains: q, mode: "insensitive" } },
          { summary: { contains: q, mode: "insensitive" } },
          { resource: { contains: q, mode: "insensitive" } },
        ],
      });
    }
    const where = { AND: and };

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: { branch: { select: { name: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return json({ items, total, page, pageSize });
  } catch (error) {
    return handleError(error, "Audit logs list");
  }
}
