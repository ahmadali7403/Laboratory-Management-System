import { getScopeOptions, publicScope, requireContext } from "@/lib/scope";
import PharmacyPOS from "@/components/pharmacy/PharmacyPOS";

export const instant = false;

export default async function PharmacyPosPage() {
  const ctx = await requireContext(undefined, { module: "pharmacy_pos", write: true });
  const options = await getScopeOptions(ctx);
  return <PharmacyPOS scope={publicScope(ctx, options)} />;
}
