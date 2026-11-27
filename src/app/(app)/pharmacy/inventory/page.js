import { getScopeOptions, publicScope, requireContext } from "@/lib/scope";
import MedicineTable from "@/components/pharmacy/MedicineTable";

export const instant = false;

export default async function PharmacyInventoryPage() {
  const ctx = await requireContext(undefined, { module: "pharmacy_inventory" });
  const options = await getScopeOptions(ctx);
  return <MedicineTable scope={publicScope(ctx, options)} />;
}
