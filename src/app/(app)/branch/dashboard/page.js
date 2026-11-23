import { requireContext } from "@/lib/scope";
import { getLabStats, getDashboardCharts } from "@/lib/stats";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";

import {
  BranchStats,
  DashboardCharts,
  QuickLinks,
  Section,
} from "@/components/dashboard-sections";

export const instant = false;

export default async function BranchDashboardPage() {
  const { actor, scope } = await requireContext(["BRANCH_ADMIN"]);

  const [stats, charts, branch] = await Promise.all([
    getLabStats(scope),
    getDashboardCharts(scope),
    prisma.branch.findFirst({
      where: {
        id: actor.branchId,
        organizationId: actor.organizationId,
      },
      select: {
        name: true,
        code: true,
        organization: {
          select: { name: true },
        },
      },
    }),
  ]);

  return (
    <div className="space-y-7">
      <PageHeader
        title={branch?.name || "Branch Dashboard"}
        description={`${branch?.organization.name || ""} · ${
          branch?.code || ""
        } · Welcome, ${actor.name}`}
      />

      <Section title="Today's Overview">
        <BranchStats s={stats} />
      </Section>

      <Section title="Laboratory Performance">
        <DashboardCharts data={charts} />
      </Section>

      <Section title="Quick Access">
        <QuickLinks
          links={[
            {
              href: "/patients",
              label: "Register Patient",
              hint: "Add and search patients",
            },
            {
              href: "/orders",
              label: "New Lab Order",
              hint: "Select tests and take payment",
            },
            {
              href: "/samples",
              label: "Sample Collection",
              hint: `${stats.pendingSamples} pending samples`,
            },
            {
              href: "/results",
              label: "Results",
              hint: `${stats.pendingResults} awaiting entry or verification`,
            },
          ]}
        />
      </Section>
    </div>
  );
}
