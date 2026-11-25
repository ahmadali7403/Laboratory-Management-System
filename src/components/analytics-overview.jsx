"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#9333ea", "#e11d48", "#0891b2", "#64748b"];
const fmt = new Intl.NumberFormat("en-PK");
const rs = (v) => `Rs ${fmt.format(Math.round(Number(v || 0)))}`;
const short = (v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : v);

function Card({ title, subtitle, children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      {subtitle && <p className="mb-2 text-xs text-slate-400">{subtitle}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}
const Empty = () => <p className="py-10 text-center text-sm text-slate-400">No data yet.</p>;

function Donut({ data, nameKey, valueKey, money }) {
  const total = data.reduce((s, d) => s + d[valueKey], 0);
  if (!total) return <Empty />;
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <div className="h-40 w-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius={42} outerRadius={70} paddingAngle={2} stroke="none">
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => (money ? rs(v) : v)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1.5 text-xs">
        {data.map((d, i) => (
          <li key={d[nameKey]} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} /><span className="truncate text-slate-600">{String(d[nameKey]).replace(/_/g, " ")}</span></span>
            <span className="shrink-0 font-semibold text-slate-800">{money ? rs(d[valueKey]) : d[valueKey]} <span className="font-normal text-slate-400">({Math.round((d[valueKey] / total) * 100)}%)</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AnalyticsOverview({ daily, topTests, byStatus, expensesByCategory, branchRows, showBranches, multiOrg }) {
  const dailyData = daily.map((d) => ({ ...d, label: d.date.slice(5) }));
  const hasRevenue = daily.some((d) => d.amount > 0);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Revenue — last 30 days" subtitle="Payments received per day" className="lg:col-span-3">
        {!hasRevenue ? <Empty /> : (
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData} margin={{ left: 0, right: 8, top: 8 }}>
                <defs><linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} /><stop offset="100%" stopColor="#2563eb" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval={4} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={short} width={40} />
                <Tooltip formatter={(v) => [rs(v), "Revenue"]} labelFormatter={(l, p) => p?.[0]?.payload?.date || l} />
                <Area type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={2} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card title="Most requested tests" subtitle="By number of orders" className="lg:col-span-2">
        {topTests.length === 0 ? <Empty /> : (
          <div style={{ height: Math.max(180, topTests.length * 34) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topTests} layout="vertical" margin={{ left: 0, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "#475569" }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v, n, p) => [`${v} orders · ${rs(p.payload.revenue)}`, "Demand"]} cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="count" fill="#7c3aed" radius={[0, 6, 6, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card title="Orders by status"><Donut data={byStatus} nameKey="status" valueKey="count" /></Card>
      <Card title="Expenses by category" className="lg:col-span-3"><Donut data={expensesByCategory} nameKey="category" valueKey="amount" money /></Card>

      {showBranches && (
        <Card title="Branch comparison" subtitle="Revenue and orders per branch" className="lg:col-span-3">
          {branchRows.length === 0 ? <Empty /> : (
            <>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={branchRows} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={short} width={40} />
                    <Tooltip formatter={(v) => [rs(v), "Revenue"]} cursor={{ fill: "#f1f5f9" }} />
                    <Bar dataKey="revenue" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left uppercase text-slate-500"><tr><th className="py-1.5">Branch</th>{multiOrg && <th>Organization</th>}<th className="text-right">Orders</th><th className="text-right">Revenue</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {branchRows.map((b) => <tr key={b.id}><td className="py-1.5 font-medium text-slate-700">{b.name}</td>{multiOrg && <td className="text-slate-500">{b.organization}</td>}<td className="text-right">{b.orders}</td><td className="text-right font-semibold">{rs(b.revenue)}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
