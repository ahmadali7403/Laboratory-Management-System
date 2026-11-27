import { connection } from "next/server";
import AppShell from "@/components/app-shell";
import { requireContext } from "@/lib/scope";

export const instant = false;

export default async function AppLayout({ children }) {
  await connection();

  // Only checks "signed in". Each page decides what a staff member may open.
  await requireContext(["SUPER_ADMIN", "ORGANIZATION_ADMIN", "BRANCH_ADMIN", "STAFF"]);

  return <AppShell>{children}</AppShell>;
}
