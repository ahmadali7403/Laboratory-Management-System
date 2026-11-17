import { notFound, redirect } from "next/navigation";

import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import BranchForm from "../branch-form";

export const instant = false;

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function NewBranchPage({ params }) {
  const admin = await getAdminSession();
  if (!admin) redirect("/login");

  const { id } = await params;
  if (!uuidRegex.test(id)) notFound();

  const organization = await prisma.organization.findUnique({
    where: { id },
    select: { id: true, name: true, code: true, status: true },
  });

  if (!organization) notFound();

  if (organization.status !== "ACTIVE") {
    redirect(`/organizations/${organization.id}/branches`);
  }

  return <BranchForm organization={organization} />;
}
