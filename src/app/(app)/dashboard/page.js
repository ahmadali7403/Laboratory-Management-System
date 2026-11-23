import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { requireContext } from "@/lib/scope";
import { getLabStats, getPlatformStats } from "@/lib/stats";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatusBadge } from "@/components/ui";
import {
  OrganizationStats,
  PlatformStats,
  QuickLinks,
  Section,
} from "@/components/dashboard-sections";
import { connection } from "next/server";
export const instant = false;

export default async function DashboardPage() {
  await connection();
  const { actor, scope } = await requireContext(["SUPER_ADMIN"]);
  const [platform, lab, recent] = await Promise.all([
    getPlatformStats(),
    getLabStats(scope),
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        _count: { select: { branches: true } },
      },
    }),
  ]);
  const label =
    scope.level === "PLATFORM"
      ? "Laboratory activity — whole platform"
      : scope.level === "ORGANIZATION"
        ? "Laboratory activity — selected organization"
        : "Laboratory activity — selected branch";
  return (
    <>
      <PageHeader
        title="Super Admin Panel"
        description={`Welcome, ${actor.name}. Platform-wide control of organizations, branches and laboratory data.`}
      />
      <Section title="Platform">
        <PlatformStats p={platform} />
      </Section>
      <Section title={label}>
        <OrganizationStats s={lab} />
      </Section>
      <Section
        title="Recent organizations"
        action={
          <Link
            href="/organizations"
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600"
          >
            Manage organizations <ArrowUpRight size={13} />
          </Link>
        }
      >
        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {recent.length === 0 && (
            <p className="p-6 text-center text-sm text-slate-500">
              No organizations yet.
            </p>
          )}
          {recent.map((o) => (
            <Link
              key={o.id}
              href={`/organizations/${o.id}`}
              className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-slate-50"
            >
              <div>
                <p className="font-semibold text-slate-800">{o.name}</p>
                <p className="text-xs text-slate-400">
                  {o.code} · {o._count.branches} branch(es)
                </p>
              </div>
              <StatusBadge value={o.status} />
            </Link>
          ))}
        </div>
      </Section>
      <Section title="Quick access">
        <QuickLinks
          links={[
            {
              href: "/organizations",
              label: "Organizations",
              hint: "Create, suspend, manage",
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
    </>
  );
}
