import { prisma } from "@/lib/prisma";
import { apiContext, scopeWhere } from "@/lib/scope";
import { handleError, json } from "@/lib/http";

export async function GET(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const sp = new URL(request.url).searchParams;
    const q = (sp.get("q") || "").trim().slice(0, 80);
    const where = {
      ...scopeWhere(auth.ctx.scope),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { mrn: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const items = await prisma.patient.findMany({
      where,
      orderBy: [{ isWalkIn: "asc" }, { createdAt: "desc" }],
      take: 30,
      select: { id: true, name: true, mrn: true, phone: true, isWalkIn: true },
    });
    return json({ items });
  } catch (error) {
    return handleError(error, "Pharmacy customer lookup");
  }
}
