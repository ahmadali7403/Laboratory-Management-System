import { requireContext } from "@/lib/scope";
import { getLabStats } from "@/lib/stats";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { OrganizationStats, QuickLinks, Section } from "@/components/dashboard-sections";

export const instant = false;

export default async function OrganizationDashboardPage() {
  const { actor, scope } = await requireContext(["ORGANIZATION_ADMIN"]);
  const [stats, org, branch] = await Promise.all([
    getLabStats(scope),
    prisma.organization.findUnique({ where: { id: actor.organizationId }, select: { name: true } }),
    scope.branchId ? prisma.branch.findUnique({ where: { id: scope.branchId }, select: { name: true } }) : null,
  ]);
  return (
    <>
      <PageHeader title={org?.name || "Organization"} description={`Welcome, ${actor.name}. ${branch ? `Showing branch: ${branch.name}.` : "Showing all branches combined."}`} />
      <Section title="Overview"><OrganizationStats s={stats} /></Section>
      <Section title="Quick access">
        <QuickLinks links={[
          { href: `/organizations/${actor.organizationId}/branches`, label: "Branch Management", hint: "Create branches & manage admin accounts" },
          { href: "/orders", label: "Laboratory Orders", hint: "Register and track lab orders" },
          { href: "/analytics", label: "Reports & Analytics", hint: "Revenue and branch comparison" },
          { href: "/staff", label: "Staff Management", hint: "Directory of lab staff" },
        ]} />
      </Section>
    </>
  );
}
