import { prisma } from "@/lib/prisma";
import { authorityWhere } from "@/lib/scope";
import { isUuid } from "@/lib/http";

/** Loads an order for printing. The actor's authority filter prevents IDOR. */
export async function loadPrintableOrder(actor, id) {
  if (!isUuid(id)) return null;
  const order = await prisma.labOrder.findFirst({
    where: { id, ...authorityWhere(actor) },
    include: {
      patient: true,
      branch: { select: { name: true, code: true, address: true, city: true, phone: true, email: true, organization: { select: { name: true, phone: true, reportConsultants: true, reportFooterNote: true } } } },
      items: { orderBy: { createdAt: "asc" }, include: { results: { orderBy: { sortOrder: "asc" } }, test: { select: { category: true, sampleType: true } } } },
      payments: { orderBy: { createdAt: "asc" } },
    },
  });
  return order;
}

/** Up to two earlier completed orders of the same patient (for the history columns). */
export async function loadPreviousResults(order) {
  const previous = await prisma.labOrder.findMany({
    where: { organizationId: order.organizationId, patientId: order.patientId, status: "COMPLETED", id: { not: order.id }, createdAt: { lt: order.createdAt } },
    orderBy: { createdAt: "desc" },
    take: 2,
    select: {
      orderNo: true, completedAt: true, createdAt: true,
      items: { select: { testCode: true, resultValue: true, flag: true, results: { select: { name: true, value: true, flag: true } } } },
    },
  });
  return previous.map((p) => {
    const map = new Map();
    for (const it of p.items) {
      if (it.results.length) for (const r of it.results) map.set(`${it.testCode}|${r.name}`, { value: r.value, flag: r.flag });
      else map.set(`${it.testCode}|`, { value: it.resultValue, flag: it.flag });
    }
    return { orderNo: p.orderNo, date: p.completedAt || p.createdAt, map };
  });
}
