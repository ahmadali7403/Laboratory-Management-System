import { notFound } from "next/navigation";

import { requireContext } from "@/lib/scope";
import { isUuid } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import OrganizationForm from "../../organization-form";

export const instant = false;

export default async function EditOrganizationPage({ params }) {
  await requireContext(["SUPER_ADMIN"]);

  const { id } = await params;
  if (!isUuid(id)) notFound();

  const organization = await prisma.organization.findUnique({
    where: { id },
  });

  if (!organization) notFound();

  return (
    <OrganizationForm
      mode="edit"
      initialData={JSON.parse(JSON.stringify(organization))}
    />
  );
}
