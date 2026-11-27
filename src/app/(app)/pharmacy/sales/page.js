import { getScopeOptions, publicScope, requireContext } from "@/lib/scope";
import PharmacySalesView from "@/components/pharmacy/PharmacySalesView";

export const instant = false;

export default async function PharmacySalesPage() {
  const ctx = await requireContext(undefined, { module: "pharmacy_pos" });
  const options = await getScopeOptions(ctx);
  return <PharmacySalesView scope={publicScope(ctx, options)} />;
}
