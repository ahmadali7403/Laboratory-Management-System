import { getScopeOptions, publicScope, requireContext } from "@/lib/scope";
import PosOrder from "@/components/modules/pos-order";

export const instant = false;

// Full-page, counter-style (POS) order screen. Staff need the "orders.manage" permission.
export default async function NewOrderPage() {
  const ctx = await requireContext(undefined, { module: "orders", write: true });
  const options = await getScopeOptions(ctx);
  return <PosOrder scope={publicScope(ctx, options)} />;
}
