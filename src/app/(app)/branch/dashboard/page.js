import { requireContext } from "@/lib/scope";
import { getLabStats } from "@/lib/stats";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { BranchStats, QuickLinks, Section } from "@/components/dashboard-sections";

export const instant = false;

export default async function BranchDashboardPage() {
  const { actor, scope } = await requireContext(["BRANCH_ADMIN"]);
  const [stats, branch] = await Promise.all([
    getLabStats(scope),
    prisma.branch.findFirst({ where: { id: actor.branchId, organizationId: actor.organizationId }, select: { name: true, code: true, organization: { select: { name: true } } } }),
  ]);
  return (
    <>
      <PageHeader title={branch?.name || "Branch"} description={`${branch?.organization.name} · ${branch?.code} · Welcome, ${actor.name}`} />
      <Section title="Today at a glance"><BranchStats s={stats} /></Section>
      <Section title="Quick access">
        <QuickLinks links={[
          { href: "/patients", label: "Register patient", hint: "Add and search patients" },
          { href: "/orders", label: "New lab order", hint: "Select tests and take payment" },
          { href: "/samples", label: "Sample collection", hint: `${stats.pendingSamples} pending` },
          { href: "/results", label: "Results", hint: `${stats.pendingResults} awaiting` },
        ]} />
      </Section>
    </>
  );
}
