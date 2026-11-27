import { getScopeOptions, publicScope, requireContext } from "@/lib/scope";
import { PharmacyCategoriesView } from "@/components/pharmacy/SimpleCatalogView";

export const instant = false;

export default async function PharmacyCategoriesPage() {
  const ctx = await requireContext(undefined, { module: "pharmacy_inventory" });
  const options = await getScopeOptions(ctx);
  return <PharmacyCategoriesView scope={publicScope(ctx, options)} />;
}
