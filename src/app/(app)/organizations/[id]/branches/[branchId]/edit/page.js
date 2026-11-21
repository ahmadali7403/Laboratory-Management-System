import { notFound, redirect } from "next/navigation";

import { canManageOrganizationBranches } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import BranchForm from "../../branch-form";

export const instant = false;

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function EditBranchPage({ params }) {
  const { id, branchId } = await params;
  if (!(await canManageOrganizationBranches(id))) redirect("/login");
  if (!uuidRegex.test(id) || !uuidRegex.test(branchId)) notFound();

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, organizationId: id },
    select: {
      id: true,
      organizationId: true,
      name: true,
      code: true,
      email: true,
      phone: true,
      address: true,
      city: true,
      status: true,
      isHeadOffice: true,
      organization: { select: { id: true, name: true, status: true } },
    },
  });

  if (!branch) notFound();

  return <BranchForm organization={branch.organization} initialData={branch} mode="edit" />;
}
