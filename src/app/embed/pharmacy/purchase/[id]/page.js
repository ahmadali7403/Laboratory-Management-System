import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { authorityWhere, requireContext } from "@/lib/scope";
import { isUuid } from "@/lib/http";
import { PharmacyPurchaseInvoice } from "@/components/pharmacy/PharmacyInvoice";

export const instant = false;

export default async function EmbedPharmacyPurchasePage({ params }) {
  const { actor } = await requireContext(undefined, { module: ["pharmacy_purchases", "pharmacy"] });
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const purchase = await prisma.pharmacyPurchase.findFirst({
    where: { id, ...authorityWhere(actor) },
    include: {
      supplier: true,
      branch: {
        select: {
          name: true,
          code: true,
          address: true,
          city: true,
          phone: true,
          email: true,
          organization: { select: { name: true, phone: true } },
        },
      },
      items: { include: { medicine: { select: { name: true, strength: true } } } },
    },
  });
  if (!purchase) notFound();
  return <PharmacyPurchaseInvoice purchase={purchase} />;
}
