import { getScopeOptions, publicScope, requireContext } from "@/lib/scope";
import PharmacySuppliersView from "@/components/pharmacy/SupplierForm";

export const instant = false;

export default async function PharmacySuppliersPage() {
  const ctx = await requireContext(undefined, { module: "pharmacy_suppliers" });
  const options = await getScopeOptions(ctx);
  return <PharmacySuppliersView scope={publicScope(ctx, options)} />;
}
