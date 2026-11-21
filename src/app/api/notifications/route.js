import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiContext, scopeWhere } from "@/lib/scope";
import { handleError, json, paging, parseBody, uuid } from "@/lib/http";

export async function GET(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const sp = new URL(request.url).searchParams;
    const { page, pageSize, skip, take } = paging(sp, 20);
    const where = { AND: [scopeWhere(auth.ctx.scope, { shared: true }), ...(sp.get("unread") === "1" ? [{ isRead: false }] : [])] };
    const [items, total, unread] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { branch: { select: { name: true } } } }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { AND: [scopeWhere(auth.ctx.scope, { shared: true }), { isRead: false }] } }),
    ]);
    return json({ items, total, unread, page, pageSize });
  } catch (error) {
    return handleError(error, "Notifications list");
  }
}

const schema = z.object({ ids: z.array(uuid).max(200).optional(), all: z.boolean().optional() });

export async function PATCH(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const parsed = await parseBody(request, schema);
    if (parsed.error) return parsed.error;
    const { ids, all } = parsed.data;
    const and = [scopeWhere(auth.ctx.scope, { shared: true }), { isRead: false }];
    if (!all) and.push({ id: { in: ids || [] } });
    const res = await prisma.notification.updateMany({ where: { AND: and }, data: { isRead: true } });
    return json({ updated: res.count });
  } catch (error) {
    return handleError(error, "Notifications update");
  }
}
