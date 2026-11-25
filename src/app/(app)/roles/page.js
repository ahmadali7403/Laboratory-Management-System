import { requireContext } from "@/lib/scope";
import RolesManager from "@/components/modules/roles-manager";

export const instant = false;

export default async function RolesPage() {
  await requireContext(["SUPER_ADMIN", "ORGANIZATION_ADMIN", "BRANCH_ADMIN"]);
  return <RolesManager />;
}
