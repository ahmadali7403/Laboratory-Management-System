import { redirect } from "next/navigation";
import { getAdminSession, getUserSession } from "@/lib/auth";

export const instant = false;

export default async function Home() {
  const admin = await getAdminSession();
  if (admin) redirect("/dashboard");
  const user = await getUserSession();
  if (user?.role === "ORGANIZATION_ADMIN") redirect("/organization/dashboard");
  if (user?.role === "BRANCH_ADMIN") redirect("/branch/dashboard");
  redirect("/login");
}
