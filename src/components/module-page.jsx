import { getScopeOptions, publicScope, requireContext } from "@/lib/scope";
import { pageModule } from "@/lib/permissions";
import ModuleView from "@/components/modules/registry";

export default async function ModulePage({ name, variant }) {
  const ctx = await requireContext(undefined, { module: pageModule(name, variant) });
  const options = await getScopeOptions(ctx);
  return <ModuleView name={name} variant={variant} scope={publicScope(ctx, options)} />;
}
