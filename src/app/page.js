import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";

export const instant = false;

export default async function Home() {
  const admin = await getAdminSession();

  if (admin) {
    redirect("/dashboard");
  }

  redirect("/login");
}
