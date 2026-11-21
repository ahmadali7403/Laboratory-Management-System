import Link from "next/link";
import { Activity, Building2, CalendarClock, CheckCircle2, ClipboardList, FileText, FlaskConical, GitBranch, TestTube, Users, UserCog, Wallet, Droplets, Banknote, ShieldCheck, UserPlus } from "lucide-react";
import StatCard, { money } from "@/components/stat-card";

export function Section({ title, children, action }) {
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-700">{title}</h2>{action}</div>
      {children}
    </section>
  );
}

export function OrganizationStats({ s }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon={GitBranch} label="Total Branches" value={s.branchesTotal} tone="blue" />
      <StatCard icon={CheckCircle2} label="Active Branches" value={s.branchesActive} tone="green" />
      <StatCard icon={UserCog} label="Total Staff" value={s.staff} tone="violet" />
      <StatCard icon={Users} label="Total Patients" value={s.patients} tone="blue" />
      <StatCard icon={TestTube} label="Tests in Catalog" value={s.tests} tone="amber" />
      <StatCard icon={ClipboardList} label="Total Orders" value={s.orders} tone="slate" />
      <StatCard icon={FileText} label="Total Reports" value={s.reports} tone="green" hint="Completed & verified" />
      <StatCard icon={Banknote} label="Total Revenue" value={money(s.revenue)} tone="green" hint="Payments received" />
    </div>
  );
}

export function BranchStats({ s }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon={Users} label="Total Patients" value={s.patients} tone="blue" />
      <StatCard icon={UserPlus} label="Today's Patients" value={s.patientsToday} tone="green" />
      <StatCard icon={ClipboardList} label="Today's Orders" value={s.ordersToday} tone="violet" />
      <StatCard icon={Droplets} label="Pending Samples" value={s.pendingSamples} tone="amber" />
      <StatCard icon={FlaskConical} label="Pending Results" value={s.pendingResults} tone="rose" hint="Awaiting entry or verification" />
      <StatCard icon={FileText} label="Completed Reports" value={s.reports} tone="green" />
      <StatCard icon={Banknote} label="Today's Revenue" value={money(s.revenueToday)} tone="green" />
      <StatCard icon={Wallet} label="Total Revenue" value={money(s.revenue)} tone="slate" />
    </div>
  );
}

export function PlatformStats({ p }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon={Building2} label="Total Organizations" value={p.orgs} tone="blue" />
      <StatCard icon={CheckCircle2} label="Active Organizations" value={p.orgActive} tone="green" />
      <StatCard icon={Activity} label="Suspended Organizations" value={p.orgSuspended} tone="rose" />
      <StatCard icon={GitBranch} label="Total Branches" value={p.branches} tone="violet" hint={`${p.branchesActive} active`} />
      <StatCard icon={UserCog} label="Total Users" value={p.users} tone="slate" />
      <StatCard icon={Users} label="Total Patients" value={p.patients} tone="blue" />
      <StatCard icon={ClipboardList} label="Total Orders" value={p.orders} tone="amber" />
      <StatCard icon={Banknote} label="Platform Revenue" value={money(p.revenue)} tone="green" />
    </div>
  );
}

export function QuickLinks({ links }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:text-blue-700">
          {l.label}<p className="mt-1 text-xs font-normal text-slate-400">{l.hint}</p>
        </Link>
      ))}
    </div>
  );
}

export { ShieldCheck, CalendarClock };
