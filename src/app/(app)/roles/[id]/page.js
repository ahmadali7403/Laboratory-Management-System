import { requireContext } from "@/lib/scope";
import RoleDetail from "@/components/modules/role-detail";

export const instant = false;

export default async function RoleDetailPage({ params }) {
  await requireContext(["SUPER_ADMIN", "ORGANIZATION_ADMIN", "BRANCH_ADMIN"]);
  const { id } = await params;
  return <RoleDetail id={id} />;
}
