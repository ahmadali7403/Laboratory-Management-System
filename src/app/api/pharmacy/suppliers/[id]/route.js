import { suppliers } from "@/lib/modules/suppliers";
import { prisma } from "@/lib/prisma";
import { apiContext, authorityWhere, isBranchBound } from "@/lib/scope";
import { fail, handleError, isUuid, json } from "@/lib/http";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    if (!isUuid(id)) return fail("Supplier not found.", 404);
    const actor = auth.ctx.actor;
    const where = {
      id,
      ...authorityWhere(actor),
      ...(isBranchBound(actor) ? { OR: [{ branchId: null }, { branchId: actor.branchId }], branchId: undefined } : {}),
    };
    const supplier = await prisma.supplier.findFirst({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        pharmacyPurchases: {
          orderBy: { purchaseDate: "desc" },
          take: 50,
          include: { branch: { select: { name: true } }, _count: { select: { items: true } } },
        },
        pharmacySupplierPayments: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { purchase: { select: { purchaseNo: true } } },
        },
      },
    });
    if (!supplier) return fail("Supplier not found.", 404);
    return json(supplier);
  } catch (error) {
    return handleError(error, "Pharmacy supplier detail");
  }
}

export const PATCH = suppliers.item.PATCH;
export const DELETE = suppliers.item.DELETE;
