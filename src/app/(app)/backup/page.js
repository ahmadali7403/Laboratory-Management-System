import { prisma } from "@/lib/prisma";
import { requireContext } from "@/lib/scope";
import BackupCenter from "@/components/modules/backup-center";

export const instant = false;

export default async function BackupPage() {
  const { actor, scope } = await requireContext();
  const [org, branch] = await Promise.all([
    scope.organizationId ? prisma.organization.findUnique({ where: { id: scope.organizationId }, select: { name: true } }) : null,
    scope.branchId ? prisma.branch.findUnique({ where: { id: scope.branchId }, select: { name: true } }) : null,
  ]);
  const label = branch ? `${org?.name} · ${branch.name}` : org ? `${org.name} · all branches` : "Whole platform";
  return <BackupCenter scope={{ role: actor.role, organizationId: scope.organizationId, branchId: scope.branchId }} scopeLabel={label} />;
}
