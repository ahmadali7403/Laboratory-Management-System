import { requireContext } from "@/lib/scope";
import { getAnalytics, getLabStats } from "@/lib/stats";
import { PageHeader } from "@/components/ui";
import StatCard, { money } from "@/components/stat-card";
import { Banknote, ClipboardList, Receipt, Wallet } from "lucide-react";

export const instant = false;

function Card({ title, children }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 text-sm font-semibold text-slate-700">{title}</h2>{children}</section>;
}
const Empty = () => <p className="py-6 text-center text-sm text-slate-400">No data yet.</p>;

export default async function AnalyticsPage() {
  const { scope } = await requireContext();
  const [a, s] = await Promise.all([getAnalytics(scope), getLabStats(scope)]);
  const max = Math.max(1, ...a.daily.map((d) => d.amount));
  const topMax = Math.max(1, ...a.topTests.map((t) => t.count));
  const net = s.revenue - a.expenseTotal;

  return (
    <>
      <PageHeader title="Reports & Analytics" description="Revenue, workload and expenses for the selected view." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Banknote} label="Revenue (all time)" value={money(s.revenue)} tone="green" />
        <StatCard icon={Wallet} label="Expenses (all time)" value={money(a.expenseTotal)} tone="rose" />
        <StatCard icon={Receipt} label="Net (revenue − expenses)" value={money(net)} tone={net >= 0 ? "blue" : "rose"} />
        <StatCard icon={ClipboardList} label="Orders" value={s.orders} tone="violet" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <Card title="Revenue — last 30 days">
            {a.daily.every((d) => d.amount === 0) ? <Empty /> : (
              <div className="flex h-44 items-end gap-1" role="img" aria-label="Daily revenue for the last 30 days">
                {a.daily.map((d) => <div key={d.date} title={`${d.date}: ${money(d.amount)}`} className="flex-1 rounded-t bg-blue-500/80 hover:bg-blue-600" style={{ height: `${Math.max(2, (d.amount / max) * 100)}%` }} />)}
              </div>
            )}
            <div className="mt-2 flex justify-between text-[10px] text-slate-400"><span>{a.daily[0].date}</span><span>{a.daily[a.daily.length - 1].date}</span></div>
          </Card>
        </div>
        <Card title="Most requested tests">
          {a.topTests.length === 0 ? <Empty /> : <ul className="space-y-3">{a.topTests.map((t) => (
            <li key={t.name}><div className="mb-1 flex justify-between text-xs"><span className="font-medium text-slate-700">{t.name}</span><span className="text-slate-500">{t.count} · {money(t.revenue)}</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-violet-500" style={{ width: `${(t.count / topMax) * 100}%` }} /></div></li>
          ))}</ul>}
        </Card>
        <Card title="Orders by status">
          {a.byStatus.length === 0 ? <Empty /> : <ul className="divide-y divide-slate-100 text-sm">{a.byStatus.map((x) => <li key={x.status} className="flex justify-between py-2"><span className="text-slate-600">{x.status.replace(/_/g, " ")}</span><b>{x.count}</b></li>)}</ul>}
        </Card>
        <Card title="Expenses by category">
          {a.expensesByCategory.length === 0 ? <Empty /> : <ul className="divide-y divide-slate-100 text-sm">{a.expensesByCategory.map((x) => <li key={x.category} className="flex justify-between py-2"><span className="text-slate-600">{x.category}</span><b>{money(x.amount)}</b></li>)}</ul>}
        </Card>
        {!scope.branchId && (
          <Card title="Branch comparison">
            {a.branchRows.length === 0 ? <Empty /> : (
              <>
              <div className="grid gap-2 sm:hidden">{a.branchRows.map((b) => <div key={b.id} className="rounded-lg bg-slate-50 p-3"><p className="break-words text-sm font-semibold text-slate-700">{b.name}</p>{!scope.organizationId && <p className="text-[11px] text-slate-400">{b.organization}</p>}<div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-500"><span>{b.orders} orders</span><b className="text-slate-700">{money(b.revenue)}</b></div></div>)}</div>
              <div className="hidden sm:block"><table className="w-full table-fixed text-sm"><thead className="text-left text-[11px] uppercase text-slate-500"><tr><th className="w-1/2 py-2">Branch</th><th className="py-2">Orders</th><th className="py-2 text-right">Revenue</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{a.branchRows.map((b) => <tr key={b.id}><td className="break-words py-2 font-medium text-slate-700">{b.name}{!scope.organizationId && <span className="block text-[11px] font-normal text-slate-400">{b.organization}</span>}</td><td className="py-2">{b.orders}</td><td className="py-2 text-right font-semibold">{money(b.revenue)}</td></tr>)}</tbody></table></div>
              </>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
