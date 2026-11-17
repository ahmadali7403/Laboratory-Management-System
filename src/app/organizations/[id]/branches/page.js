import { notFound, redirect } from "next/navigation";

import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import BranchesClient from "./branches-client";

export const instant = false;

export default async function BranchesPage({ params }) {
  const admin = await getAdminSession();

  if (!admin) redirect("/login");

  const { id } = await params;

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(id)) notFound();

  const organization = await prisma.organization.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
    },
  });

  if (!organization) notFound();

  return <BranchesClient organization={organization} />;
}
