import { requireContext } from "@/lib/scope";
import OrganizationsClient from "./organizations-client";

export const instant = false;

export default async function OrganizationsPage() {
  const { actor } = await requireContext(["SUPER_ADMIN"]);

  return <OrganizationsClient adminName={actor.name} />;
}
