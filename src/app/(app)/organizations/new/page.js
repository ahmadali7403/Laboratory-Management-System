import { requireContext } from "@/lib/scope";
import OrganizationForm from "../organization-form";

export const instant = false;

export default async function NewOrganizationPage() {
  await requireContext(["SUPER_ADMIN"]);

  return <OrganizationForm mode="create" />;
}
