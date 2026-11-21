import AppShell from "@/components/app-shell";
import { requireContext } from "@/lib/scope";

export const instant = false;

export default async function AppLayout({ children }) {
  await requireContext();
  return <AppShell>{children}</AppShell>;
}
