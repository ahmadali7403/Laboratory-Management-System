import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { authorityWhere, requireContext } from "@/lib/scope";
import { isUuid } from "@/lib/http";
import { PharmacyInvoice } from "@/components/pharmacy/PharmacyInvoice";

export const instant = false;

export default async function EmbedPharmacyInvoicePage({ params }) {
  const { actor } = await requireContext(undefined, { module: ["pharmacy_pos", "pharmacy", "billing"] });
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const sale = await prisma.pharmacySale.findFirst({
    where: { id, ...authorityWhere(actor) },
    include: {
      patient: { select: { name: true, mrn: true, phone: true } },
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
      items: true,
      payments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!sale) notFound();
  return <PharmacyInvoice sale={sale} />;
}
