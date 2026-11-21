import { getScopeOptions, publicScope, requireContext } from "@/lib/scope";
import ModuleView from "@/components/modules/registry";

export default async function ModulePage({ name }) {
  const ctx = await requireContext();
  const options = await getScopeOptions(ctx);
  return <ModuleView name={name} scope={publicScope(ctx, options)} />;
}
