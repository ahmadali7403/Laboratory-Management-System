import { getScopeOptions, publicScope, requireContext } from "@/lib/scope";
import PharmacyPurchasesView from "@/components/pharmacy/PharmacyPurchasesView";

export const instant = false;

export default async function PharmacyPurchasesPage() {
  const ctx = await requireContext(undefined, { module: "pharmacy_purchases" });
  const options = await getScopeOptions(ctx);
  return <PharmacyPurchasesView scope={publicScope(ctx, options)} />;
}
