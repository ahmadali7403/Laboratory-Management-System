import { getScopeOptions, publicScope, requireContext } from "@/lib/scope";
import PharmacyStats from "@/components/pharmacy/PharmacyStats";

export const instant = false;

export default async function PharmacyDashboardPage() {
  const ctx = await requireContext(undefined, { module: ["pharmacy", "pharmacy_pos", "pharmacy_inventory"] });
  const options = await getScopeOptions(ctx);
  return <PharmacyStats scope={publicScope(ctx, options)} />;
}
