import { requireContext } from "@/lib/scope";
import ProfileForm from "@/components/modules/profile-form";

export const instant = false;

export default async function ProfilePage() {
  await requireContext(["SUPER_ADMIN", "ORGANIZATION_ADMIN", "BRANCH_ADMIN"]);

  return <ProfileForm />;
}
