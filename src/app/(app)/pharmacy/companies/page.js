import { getScopeOptions, publicScope, requireContext } from "@/lib/scope";
import { PharmacyCompaniesView } from "@/components/pharmacy/SimpleCatalogView";

export const instant = false;

export default async function PharmacyCompaniesPage() {
  const ctx = await requireContext(undefined, { module: "pharmacy_inventory" });
  const options = await getScopeOptions(ctx);
  return <PharmacyCompaniesView scope={publicScope(ctx, options)} />;
}
