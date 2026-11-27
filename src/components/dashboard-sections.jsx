import Link from "next/link";
import {
  Activity,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileText,
  GitBranch,
  TestTube,
  Users,
  UserCog,
  Wallet,
  Droplets,
  Banknote,
  UserPlus,
} from "lucide-react";

import StatCard, { money } from "@/components/stat-card";

import {
  DailyActivityChart,
  MonthlyPerformanceChart,
  OrderStatusChart,
  OrganizationGrowthChart,
  BranchComparisonChart,
  OrganizationStatusChart,
} from "@/components/dashboard-charts-lazy";

export function Section({ title, children, action }) {
  return (
    <section className="mb-7">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold tracking-tight text-slate-800">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function OrganizationStats({ s }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        icon={GitBranch}
        label="Total Branches"
        value={s.branchesTotal}
        tone="blue"
      />
      <StatCard
        icon={CheckCircle2}
        label="Active Branches"
        value={s.branchesActive}
        tone="green"
      />
      <StatCard
        icon={UserCog}
        label="Total Staff"
        value={s.staff}
        tone="violet"
      />
      <StatCard
        icon={Users}
        label="Total Patients"
        value={s.patients}
        tone="blue"
      />
      <StatCard
        icon={TestTube}
        label="Tests in Catalog"
        value={s.tests}
        tone="amber"
      />
      <StatCard
        icon={ClipboardList}
        label="Total Orders"
        value={s.orders}
        tone="slate"
      />
      <StatCard
        icon={FileText}
        label="Completed Reports"
        value={s.reports}
        tone="green"
      />
      <StatCard
        icon={Banknote}
        label="Total Revenue"
        value={money(s.revenue)}
        tone="green"
        hint="Payments received"
      />
    </div>
  );
}

export function BranchStats({ s }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        icon={Users}
        label="Total Patients"
        value={s.patients}
        tone="blue"
        href="/patients"
      />
      <StatCard
        icon={UserPlus}
        label="Today's Patients"
        value={s.patientsToday}
        tone="green"
      />
      <StatCard
        icon={ClipboardList}
        label="Today's Orders"
        value={s.ordersToday}
        tone="violet"
      />
      <StatCard
        icon={Droplets}
        label="Pending Samples"
        value={s.pendingSamples}
        tone="amber"
        href="/samples/collect"
      />
      <StatCard
        icon={Activity}
        label="Pending Results"
        value={s.pendingResults}
        tone="rose"
        hint="Awaiting entry or verification"
        href="/results/enter"
      />
      <StatCard
        icon={FileText}
        label="Completed Reports"
        value={s.reports}
        tone="green"
        href="/reports"
      />
      <StatCard
        icon={Banknote}
        label="Today's Revenue"
        value={money(s.revenueToday)}
        tone="green"
      />
      <StatCard
        icon={Wallet}
        label="Total Revenue"
        value={money(s.revenue)}
        tone="slate"
      />
    </div>
  );
}

export function PlatformStats({ p }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        icon={Building2}
        label="Total Organizations"
        value={p.orgs}
        tone="blue"
      />
      <StatCard
        icon={CheckCircle2}
        label="Active Organizations"
        value={p.orgActive}
        tone="green"
      />
      <StatCard
        icon={Activity}
        label="Suspended Organizations"
        value={p.orgSuspended}
        tone="rose"
      />
      <StatCard
        icon={GitBranch}
        label="Total Branches"
        value={p.branches}
        tone="violet"
        hint={`${p.branchesActive} active`}
      />
      <StatCard
        icon={UserCog}
        label="Total Users"
        value={p.users}
        tone="slate"
      />
      <StatCard
        icon={Users}
        label="Total Patients"
        value={p.patients}
        tone="blue"
      />
      <StatCard
        icon={ClipboardList}
        label="Total Orders"
        value={p.orders}
        tone="amber"
      />
      <StatCard
        icon={Banknote}
        label="Platform Revenue"
        value={money(p.revenue)}
        tone="green"
      />
    </div>
  );
}

/** Charts shared by Organization Admin and Branch Admin dashboards. */
export function DashboardCharts({ data }) {
  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <DailyActivityChart data={data.daily || []} />
        <MonthlyPerformanceChart data={data.monthly || []} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <OrderStatusChart data={data.byStatus || []} />
        {data.branchRows?.length > 0 ? (
          <BranchComparisonChart data={data.branchRows} />
        ) : (
          <div className="flex min-h-[300px] flex-col justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800">
              Laboratory Activity
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Daily and monthly charts show your branch&apos;s laboratory
              performance.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Platform-only charts for Super Admin dashboard. */
export function PlatformDashboardCharts({ data }) {
  if (!data) return null;

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <OrganizationGrowthChart data={data.organizationGrowth || []} />
      <OrganizationStatusChart data={data.organizationStatuses || []} />
    </div>
  );
}

export function QuickLinks({ links }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-700"
        >
          {link.label}
          <p className="mt-1 text-xs font-normal text-slate-400">{link.hint}</p>
        </Link>
      ))}
    </div>
  );
}

/** Step-by-step lab workflow so new staff always know what to do next. */
export function WorkflowStrip({ steps }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {steps.map((step, i) => (
        <li key={step.href}>
          <Link
            href={step.href}
            className="flex h-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">
                {step.label}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {step.hint}
              </span>
              {step.count > 0 && (
                <span className="mt-1.5 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                  {step.count} waiting
                </span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
