import { notFound, redirect } from "next/navigation";

import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OrganizationForm from "../../organization-form";

export const instant = false;

export default async function EditOrganizationPage({ params }) {
  const admin = await getAdminSession();

  if (!admin) redirect("/login");

  const { id } = await params;

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
