import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import OrganizationsClient from "./organizations-client";

export const instant = false;

export default async function OrganizationsPage() {
  const admin = await getAdminSession();
  if (!admin) redirect("/login");

  return <OrganizationsClient adminName={admin.name} />;
}
