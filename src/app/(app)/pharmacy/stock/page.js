import { getScopeOptions, publicScope, requireContext } from "@/lib/scope";
import PharmacyStockView from "@/components/pharmacy/StockAdjustmentModal";

export const instant = false;

export default async function PharmacyStockPage() {
  const ctx = await requireContext(undefined, { module: ["pharmacy_inventory", "pharmacy"] });
  const options = await getScopeOptions(ctx);
  return <PharmacyStockView scope={publicScope(ctx, options)} />;
}
