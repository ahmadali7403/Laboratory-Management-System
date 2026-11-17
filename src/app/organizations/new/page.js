import { redirect } from "next/navigation";

import { getAdminSession } from "@/lib/auth";
import OrganizationForm from "../organization-form";

export const instant = false;

export default async function NewOrganizationPage() {
  const admin = await getAdminSession();

  if (!admin) redirect("/login");

  return <OrganizationForm mode="create" />;
}
