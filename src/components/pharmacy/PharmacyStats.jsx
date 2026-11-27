"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Banknote, Boxes, Clock, Pill, Plus, ShoppingBag, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { api, formatDate, formatDateTime, formatMoney } from "@/lib/client";
import StatCard, { money } from "@/components/stat-card";
import { Badge, Button, ErrorState, PageHeader, Spinner, StatusBadge } from "@/components/ui";
import { hasModule } from "@/lib/permissions";

export default function PharmacyStats({ scope }) {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState({ key: "", data: null, error: "" });
  const reqKey = `${scope.organizationId || ""}|${scope.branchId || ""}|${tick}`;
  const { data, error } = state;

  function load() {
    setTick((t) => t + 1);
  }

  useEffect(() => {
    const ctrl = new AbortController();
    api("/api/pharmacy/dashboard", { signal: ctrl.signal })
      .then((d) => setState({ key: reqKey, data: d, error: "" }))
      .catch((e) => e.name !== "AbortError" && setState({ key: reqKey, data: null, error: e.message }));
    return () => ctrl.abort();
  }, [reqKey]);

  const canPos = !scope.isStaff || hasModule(scope.permissions || [], "pharmacy_pos", true);
  const canInv = !scope.isStaff || hasModule(scope.permissions || [], "pharmacy_inventory");
  const canPur = !scope.isStaff || hasModule(scope.permissions || [], "pharmacy_purchases");
  const canSup = !scope.isStaff || hasModule(scope.permissions || [], "pharmacy_suppliers");

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Spinner label="Loading pharmacy dashboard..." />;

  const s = data.stats;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pharmacy Dashboard"
        description="Real-time overview of medicine stock, sales, purchases, and expiry alerts."
        actions={
          <div className="flex flex-wrap gap-2">
            {canPos && (
              <Link href="/pharmacy/pos" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[13px] font-semibold text-white shadow-sm hover:bg-emerald-700">
                <ShoppingBag size={15} /> Open Pharmacy POS
              </Link>
            )}
            {canPur && (
              <Link href="/pharmacy/purchases?new=1" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">
                <Plus size={15} /> New Purchase
              </Link>
            )}
            {canInv && (
              <Link href="/pharmacy/inventory" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">
                <Pill size={15} /> Medicine Inventory
              </Link>
            )}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Pill} label="Total Medicines" value={s.totalMedicines} tone="blue" href={canInv ? "/pharmacy/inventory" : undefined} />
        <StatCard icon={Boxes} label="Total Stock Value" value={money(s.totalStockValue)} tone="violet" hint={`Retail: ${formatMoney(s.totalRetailValue)}`} href={canInv ? "/pharmacy/stock" : undefined} />
        <StatCard icon={TrendingUp} label="Today's Sales" value={money(s.todaySalesTotal)} tone="green" hint={`${s.todaySalesCount} bills · Collected ${formatMoney(s.todaySalesCollected)}`} href={canPos ? "/pharmacy/sales" : undefined} />
        <StatCard icon={ShoppingCart} label="Today's Purchases" value={money(s.todayPurchasesTotal)} tone="slate" hint={`${s.todayPurchasesCount} finalized`} href={canPur ? "/pharmacy/purchases" : undefined} />
        <StatCard icon={AlertTriangle} label="Low / Out of Stock" value={s.lowStockCount + s.outOfStockCount} tone={s.lowStockCount + s.outOfStockCount > 0 ? "amber" : "green"} hint={`${s.outOfStockCount} out · ${s.lowStockCount} low`} href="/pharmacy/alerts" />
        <StatCard icon={Clock} label="Near Expiry (30d)" value={s.nearExpiryCount} tone={s.nearExpiryCount > 0 ? "amber" : "green"} hint="Batches expiring within 30 days" href="/pharmacy/alerts" />
        <StatCard icon={AlertTriangle} label="Expired Medicines" value={s.expiredCount} tone={s.expiredCount > 0 ? "rose" : "green"} hint="Batches with stock > 0" href="/pharmacy/alerts" />
        {canSup ? (
          <StatCard icon={Users} label="Supplier Payable" value={money(s.supplierPayable)} tone={s.supplierPayable > 0 ? "amber" : "slate"} href="/pharmacy/suppliers" />
        ) : (
          <StatCard icon={Banknote} label="Today's Cash In" value={money(s.todaySalesCollected)} tone="green" />
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-600">Low &amp; Out of Stock Medicines</h2>
            <Link href="/pharmacy/alerts" className="text-xs font-semibold text-blue-600 hover:underline">View all</Link>
          </div>
          {data.lowStockMedicines.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">All medicines are adequately stocked.</p>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                  <tr><th className="px-2 py-1.5">Medicine</th><th className="px-2 py-1.5 text-right">Available</th><th className="px-2 py-1.5 text-right">Alert</th><th className="px-2 py-1.5 text-right">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.lowStockMedicines.map((m) => (
                    <tr key={m.id}>
                      <td className="px-2 py-1.5 font-medium text-slate-800">{m.name} {m.strength || ""}</td>
                      <td className="px-2 py-1.5 text-right font-bold tabular-nums">{m.validStock} {m.unit}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{m.lowStockAlert}</td>
                      <td className="px-2 py-1.5 text-right"><Badge tone={m.stockStatus === "OUT" ? "red" : "amber"}>{m.stockStatus}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-600">Near Expiry &amp; Expired Batches</h2>
            <Link href="/pharmacy/alerts" className="text-xs font-semibold text-blue-600 hover:underline">Manage expiry</Link>
          </div>
          {data.expiredBatches.length === 0 && data.nearExpiryBatches.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">No expired or near-expiry batches.</p>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                  <tr><th className="px-2 py-1.5">Medicine</th><th className="px-2 py-1.5">Batch</th><th className="px-2 py-1.5">Expiry</th><th className="px-2 py-1.5 text-right">Qty</th><th className="px-2 py-1.5 text-right">State</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.expiredBatches.map((b) => (
                    <tr key={b.id} className="bg-rose-50/40">
                      <td className="px-2 py-1.5 font-medium text-slate-800">{b.medicine.name}</td>
                      <td className="px-2 py-1.5 font-mono">{b.batchNumber}</td>
                      <td className="px-2 py-1.5 text-rose-700 font-semibold">{formatDate(b.expiryDate)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{Number(b.quantity)}</td>
                      <td className="px-2 py-1.5 text-right"><Badge tone="red">EXPIRED</Badge></td>
                    </tr>
                  ))}
                  {data.nearExpiryBatches.map((b) => (
                    <tr key={b.id}>
                      <td className="px-2 py-1.5 font-medium text-slate-800">{b.medicine.name}</td>
                      <td className="px-2 py-1.5 font-mono">{b.batchNumber}</td>
                      <td className="px-2 py-1.5 text-amber-700 font-semibold">{formatDate(b.expiryDate)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{Number(b.quantity)}</td>
                      <td className="px-2 py-1.5 text-right"><Badge tone="amber">NEAR EXPIRY</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-600">Recent Pharmacy Sales</h2>
            <Link href="/pharmacy/sales" className="text-xs font-semibold text-blue-600 hover:underline">All sales</Link>
          </div>
          {data.recentSales.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">No pharmacy sales recorded yet.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                <tr><th className="px-2 py-1.5">Sale #</th><th className="px-2 py-1.5">Customer</th><th className="px-2 py-1.5 text-right">Total</th><th className="px-2 py-1.5 text-right">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recentSales.map((sale) => (
                  <tr key={sale.id}>
                    <td className="px-2 py-1.5 font-mono font-semibold text-emerald-700">{sale.saleNo}<span className="block font-sans text-[10px] font-normal text-slate-400">{formatDateTime(sale.createdAt)}</span></td>
                    <td className="px-2 py-1.5">{sale.customerName}</td>
                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{formatMoney(sale.total)}</td>
                    <td className="px-2 py-1.5 text-right"><StatusBadge value={sale.paymentStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-600">Recent Pharmacy Purchases</h2>
            {canPur && <Link href="/pharmacy/purchases" className="text-xs font-semibold text-blue-600 hover:underline">All purchases</Link>}
          </div>
          {data.recentPurchases.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">No pharmacy purchases recorded yet.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                <tr><th className="px-2 py-1.5">Purchase #</th><th className="px-2 py-1.5">Supplier</th><th className="px-2 py-1.5 text-right">Total</th><th className="px-2 py-1.5 text-right">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recentPurchases.map((p) => (
                  <tr key={p.id}>
                    <td className="px-2 py-1.5 font-mono font-semibold text-blue-700">{p.purchaseNo}<span className="block font-sans text-[10px] font-normal text-slate-400">{formatDate(p.purchaseDate)}</span></td>
                    <td className="px-2 py-1.5">{p.supplier?.name || "—"}</td>
                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{formatMoney(p.total)}</td>
                    <td className="px-2 py-1.5 text-right"><StatusBadge value={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
