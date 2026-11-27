import { getScopeOptions, publicScope, requireContext } from "@/lib/scope";
import AuditLogsView from "@/components/modules/audit-logs-view";

export const instant = false;

export default async function AuditLogsPage() {
  const ctx = await requireContext(["SUPER_ADMIN", "ORGANIZATION_ADMIN", "BRANCH_ADMIN"]);
  const options = await getScopeOptions(ctx);
  return <AuditLogsView scope={publicScope(ctx, options)} />;
}
