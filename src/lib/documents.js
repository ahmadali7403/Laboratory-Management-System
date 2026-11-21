import { prisma } from "@/lib/prisma";
import { authorityWhere } from "@/lib/scope";
import { isUuid } from "@/lib/http";

/** Loads an order for printing. The actor's authority filter prevents IDOR. */
export async function loadPrintableOrder(actor, id) {
  if (!isUuid(id)) return null;
  return prisma.labOrder.findFirst({
    where: { id, ...authorityWhere(actor) },
    include: {
      patient: true,
      doctor: { select: { name: true } },
      branch: { select: { name: true, code: true, address: true, city: true, phone: true, email: true, organization: { select: { name: true, phone: true } } } },
      items: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "asc" } },
    },
  });
}
