import { requireContext } from "@/lib/scope";
import { getAnalytics, getLabStats } from "@/lib/stats";
import { PageHeader } from "@/components/ui";
import StatCard, { money } from "@/components/stat-card";
import Link from "next/link";
import {
  Banknote,
  Boxes,
  ClipboardList,
  Droplets,
  FlaskConical,
  Receipt,
  ShoppingCart,
  Stethoscope,
  TestTube,
  TrendingUp,
  Truck,
  UserCog,
  Users,
  Wallet,
  ArrowRight,
} from "lucide-react";
import AnalyticsOverview from "@/components/analytics-overview";
import { REPORT_MODULES } from "@/lib/report-engine";

const ICONS = {
  Users,
  Stethoscope,
  TestTube,
  ClipboardList,
  Droplets,
  FlaskConical,
  Receipt,
  Wallet,
  Truck,
  ShoppingCart,
  Boxes,
  UserCog,
  TrendingUp,
};

export const instant = false;

export default async function AnalyticsPage() {
  const { scope } = await requireContext();
  const [a, s] = await Promise.all([getAnalytics(scope), getLabStats(scope)]);
  const net = s.revenue - a.expenseTotal;

  return (
    <>
      <h2 className="mb-3 text-sm font-semibold text-slate-700">
        Overview{" "}
        <span className="font-normal text-slate-400">
          · all time, for the selected view
        </span>
      </h2>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Banknote}
          label="Revenue"
          value={money(s.revenue)}
          tone="green"
        />
        <StatCard
          icon={Wallet}
          label="Expenses"
          value={money(a.expenseTotal)}
          tone="rose"
        />
        <StatCard
          icon={Receipt}
          label="Net (revenue − expenses)"
          value={money(net)}
          tone={net >= 0 ? "blue" : "rose"}
        />
        <StatCard
          icon={ClipboardList}
          label="Orders"
          value={s.orders}
          tone="violet"
          hint={`${s.ordersToday} today`}
        />
        <StatCard
          icon={Users}
          label="Patients"
          value={s.patients}
          tone="blue"
          hint={`${s.patientsToday} new today`}
        />
        <StatCard
          icon={Droplets}
          label="Samples pending"
          value={s.pendingSamples}
          tone="amber"
        />
        <StatCard
          icon={FlaskConical}
          label="Results pending"
          value={s.pendingResults}
          tone="amber"
        />
        <StatCard
          icon={TestTube}
          label="Active tests"
          value={s.tests}
          tone="slate"
        />
      </div>
      <AnalyticsOverview
        daily={a.daily}
        topTests={a.topTests}
        byStatus={a.byStatus}
        expensesByCategory={a.expensesByCategory}
        branchRows={a.branchRows}
        showBranches={!scope.branchId}
        multiOrg={!scope.organizationId}
      />
      <PageHeader
        title="Reports & Analytics"
        description="Pick a module for its combined report, or open one record for an individual report."
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {REPORT_MODULES.map((m) => {
          const Icon = ICONS[m.icon] || ClipboardList;
          return (
            <Link
              key={m.key}
              href={`/analytics/${m.key}`}
              className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Icon size={19} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900">
                  {m.title}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {m.description}
                </span>
                <span className="mt-1.5 block text-[11px] text-slate-400">
                  Combined · Individual {m.entity.toLowerCase()}
                </span>
              </span>
              <ArrowRight
                size={16}
                className="mt-1 text-slate-300 group-hover:text-blue-500"
              />
            </Link>
          );
        })}
      </div>
    </>
  );
}
