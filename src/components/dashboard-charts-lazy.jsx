"use client";

import dynamic from "next/dynamic";

function ChartSkeleton({ height = 280 }) {
  return (
    <div
      className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      style={{ height: height + 68 }}
    >
      <div className="h-4 w-40 rounded bg-slate-200" />
      <div className="mt-2 h-3 w-56 rounded bg-slate-100" />
      <div className="mt-6 h-[calc(100%-3.5rem)] rounded-xl bg-slate-50" />
    </div>
  );
}

export const DailyActivityChart = dynamic(
  () => import("@/components/dashboard-charts").then((m) => m.DailyActivityChart),
  { ssr: false, loading: () => <ChartSkeleton height={320} /> },
);

export const MonthlyPerformanceChart = dynamic(
  () => import("@/components/dashboard-charts").then((m) => m.MonthlyPerformanceChart),
  { ssr: false, loading: () => <ChartSkeleton height={300} /> },
);

export const OrderStatusChart = dynamic(
  () => import("@/components/dashboard-charts").then((m) => m.OrderStatusChart),
  { ssr: false, loading: () => <ChartSkeleton height={280} /> },
);

export const OrganizationGrowthChart = dynamic(
  () => import("@/components/dashboard-charts").then((m) => m.OrganizationGrowthChart),
  { ssr: false, loading: () => <ChartSkeleton height={280} /> },
);

export const BranchComparisonChart = dynamic(
  () => import("@/components/dashboard-charts").then((m) => m.BranchComparisonChart),
  { ssr: false, loading: () => <ChartSkeleton height={280} /> },
);

export const OrganizationStatusChart = dynamic(
  () => import("@/components/dashboard-charts").then((m) => m.OrganizationStatusChart),
  { ssr: false, loading: () => <ChartSkeleton height={280} /> },
);
