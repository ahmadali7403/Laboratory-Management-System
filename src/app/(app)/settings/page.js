import { redirect } from "next/navigation";
import { requireContext } from "@/lib/scope";
import SettingsForm from "@/components/modules/settings-forms";

export const instant = false;

export default async function SettingsPage() {
  const { actor, scope } = await requireContext();
  if (!scope.organizationId) redirect("/platform-settings");
  // Branch admin: always its branch. Org/Super: the branch when one is selected, else the organization.
  const kind = actor.role === "BRANCH_ADMIN" || scope.branchId ? "branch" : "organization";
  return <SettingsForm key={kind + (scope.branchId || scope.organizationId)} kind={kind} />;
}
