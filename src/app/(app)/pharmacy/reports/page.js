import { getScopeOptions, publicScope, requireContext } from "@/lib/scope";
import PharmacyReportsView from "@/components/pharmacy/PharmacyReportsView";

export const instant = false;

export default async function PharmacyReportsPage() {
  const ctx = await requireContext(undefined, { module: ["pharmacy_reports", "pharmacy"] });
  const options = await getScopeOptions(ctx);
  return <PharmacyReportsView scope={publicScope(ctx, options)} />;
}
