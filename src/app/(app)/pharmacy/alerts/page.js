import { getScopeOptions, publicScope, requireContext } from "@/lib/scope";
import PharmacyAlertsView from "@/components/pharmacy/PharmacyAlertsView";

export const instant = false;

export default async function PharmacyAlertsPage() {
  const ctx = await requireContext(undefined, { module: ["pharmacy", "pharmacy_inventory"] });
  const options = await getScopeOptions(ctx);
  return <PharmacyAlertsView scope={publicScope(ctx, options)} />;
}
