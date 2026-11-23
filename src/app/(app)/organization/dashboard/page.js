import { requireContext } from "@/lib/scope";
import { getLabStats, getDashboardCharts } from "@/lib/stats";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";

import {
  OrganizationStats,
  DashboardCharts,
  QuickLinks,
  Section,
} from "@/components/dashboard-sections";

export const instant = false;

export default async function OrganizationDashboardPage() {
  const { actor, scope } = await requireContext(["ORGANIZATION_ADMIN"]);

  const [stats, charts, org, branch] = await Promise.all([
    getLabStats(scope),
    getDashboardCharts(scope),
    prisma.organization.findUnique({
      where: { id: actor.organizationId },
      select: { name: true },
    }),
    scope.branchId
      ? prisma.branch.findUnique({
          where: { id: scope.branchId },
          select: { name: true },
        })
      : null,
  ]);

  return (
    <div className="space-y-7">
      <PageHeader
        title={org?.name || "Organization Dashboard"}
        description={`Welcome, ${actor.name}. ${
          branch
            ? `Showing branch: ${branch.name}.`
            : "Complete overview of all your organization's branches."
        }`}
      />

      <Section title="Organization Overview">
        <OrganizationStats s={stats} />
      </Section>

      <Section title="Laboratory Analytics">
        <DashboardCharts data={charts} />
      </Section>

      <Section title="Branch Performance">
        {charts.branchRows.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            {scope.branchId
              ? "Branch comparison is available when viewing the full organization."
              : "No branch activity available yet."}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="divide-y divide-slate-100">
              {charts.branchRows.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-blue-700">
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {item.organization}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-6 text-right">
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {item.orders}
                      </p>
                      <p className="text-xs text-slate-400">Orders</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-600">
                        Rs. {Number(item.revenue).toLocaleString("en-PK")}
                      </p>
                      <p className="text-xs text-slate-400">Revenue</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      <Section title="Quick Access">
        <QuickLinks
          links={[
            {
              href: `/organizations/${actor.organizationId}/branches`,
              label: "Branch Management",
              hint: "Create branches and manage admin accounts",
            },
            {
              href: "/orders",
              label: "Laboratory Orders",
              hint: "Register and track lab orders",
            },
            {
              href: "/analytics",
              label: "Reports & Analytics",
              hint: "Revenue and branch comparison",
            },
            {
              href: "/staff",
              label: "Staff Management",
              hint: "Directory of laboratory staff",
            },
          ]}
        />
      </Section>
    </div>
  );
}
