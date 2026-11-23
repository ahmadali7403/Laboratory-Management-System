import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { connection } from "next/server";

import { requireContext } from "@/lib/scope";
import {
  getLabStats,
  getPlatformStats,
  getDashboardCharts,
  getPlatformDashboardCharts,
} from "@/lib/stats";
import { prisma } from "@/lib/prisma";

import { PageHeader, StatusBadge } from "@/components/ui";

import {
  OrganizationStats,
  PlatformStats,
  PlatformDashboardCharts,
  DashboardCharts,
  QuickLinks,
  Section,
} from "@/components/dashboard-sections";

export const instant = false;

export default async function DashboardPage() {
  await connection();

  const { actor, scope } = await requireContext(["SUPER_ADMIN"]);

  const [platform, lab, platformCharts, labCharts, recent] = await Promise.all([
    getPlatformStats(),
    getLabStats(scope),
    getPlatformDashboardCharts(),
    getDashboardCharts(scope),
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        _count: {
          select: { branches: true },
        },
      },
    }),
  ]);

  return (
    <div className="space-y-7">
      <PageHeader
        title="Super Admin Dashboard"
        description={`Welcome, ${actor.name}. Here's your complete platform overview.`}
      />

      <Section title="Platform Overview">
        <PlatformStats p={platform} />
      </Section>

      <Section title="Organization Analytics">
        <PlatformDashboardCharts data={platformCharts} />
      </Section>

      <Section title="Laboratory Performance">
        <OrganizationStats s={lab} />
        <div className="mt-5">
          <DashboardCharts data={labCharts} />
        </div>
      </Section>

      <Section
        title="Top Organizations"
        action={
          <Link
            href="/organizations"
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            Manage organizations
            <ArrowUpRight size={13} />
          </Link>
        }
      >
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {platformCharts.topOrganizations.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              No organization activity available yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {platformCharts.topOrganizations.map((organization, index) => (
                <Link
                  key={organization.id}
                  href={`/organizations/${organization.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-slate-50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-blue-700">
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {organization.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {organization.code}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800">
                      {organization.orders}
                    </p>
                    <p className="text-xs text-slate-400">Orders</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section title="Recent Organizations">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {recent.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              No organizations yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recent.map((organization) => (
                <Link
                  key={organization.id}
                  href={`/organizations/${organization.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-slate-50"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {organization.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {organization.code} · {organization._count.branches}{" "}
                      branch(es)
                    </p>
                  </div>
                  <StatusBadge value={organization.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section title="Quick Access">
        <QuickLinks
          links={[
            {
              href: "/organizations",
              label: "Organizations",
              hint: "Create, suspend and manage",
            },
            {
              href: "/branches",
              label: "All Branches",
              hint: "Across every organization",
            },
            {
              href: "/analytics",
              label: "Analytics",
              hint: "Platform reports",
            },
            {
              href: "/platform-settings",
              label: "Platform Settings",
              hint: "Global configuration",
            },
          ]}
        />
      </Section>
    </div>
  );
}
