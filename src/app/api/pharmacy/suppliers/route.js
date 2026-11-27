import { suppliers } from "@/lib/modules/suppliers";
import { prisma } from "@/lib/prisma";
import { apiContext, scopeWhere } from "@/lib/scope";
import { handleError, json } from "@/lib/http";

export async function GET(request) {
  try {
    const sp = new URL(request.url).searchParams;
    if (sp.get("options") === "1") {
      const auth = await apiContext(request);
      if (auth.error) return auth.error;
      const items = await prisma.supplier.findMany({
        where: { ...scopeWhere(auth.ctx.scope, { shared: true }), isActive: true },
        orderBy: { name: "asc" },
        take: 200,
        select: { id: true, name: true, phone: true, pharmacyBalance: true },
      });
      return json({ items });
    }
    return suppliers.collection.GET(request);
  } catch (error) {
    return handleError(error, "Pharmacy suppliers");
  }
}

export const POST = suppliers.collection.POST;
