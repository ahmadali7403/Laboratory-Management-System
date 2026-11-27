"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Clock, RefreshCw, Trash2 } from "lucide-react";
import { api, formatDate, formatMoney } from "@/lib/client";
import { hasModule } from "@/lib/permissions";
import { Badge, Button, EmptyState, ErrorState, PageHeader, Spinner } from "@/components/ui";
import { StockAdjustmentModal } from "@/components/pharmacy/StockAdjustmentModal";

export default function PharmacyAlertsView({ scope }) {
  const canAdjust = !scope.isStaff || hasModule(scope.permissions || [], "pharmacy_inventory", true) || hasModule(scope.permissions || [], "pharmacy", true);
  const [tab, setTab] = useState("low"); // "low" | "expired" | "expiring30" | "expiring90"
  const [tick, setTick] = useState(0);
  const [state, setState] = useState({ key: "", data: null, error: "" });
  const reqKey = `${scope.organizationId || ""}|${scope.branchId || ""}|${tick}`;
  const loading = state.key !== reqKey;
  const { data, error } = state;
  const [writeOffBatch, setWriteOffBatch] = useState(null);

  const load = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    api("/api/pharmacy/alerts", { signal: ctrl.signal })
      .then((d) => setState({ key: reqKey, data: d, error: "" }))
      .catch((e) => e.name !== "AbortError" && setState((s) => ({ ...s, key: reqKey, error: e.message })));
    return () => ctrl.abort();
  }, [reqKey]);

  return (
    <div className="space-y-2">
      <PageHeader
        title="Low Stock & Expiry Management"
        description="Monitor out-of-stock, low-stock, near-expiry, and expired medicine batches."
        actions={<Button variant="secondary" onClick={load}><RefreshCw size={15} className={loading ? "animate-spin" : ""} /></Button>}
      />

      <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1 text-xs font-semibold">
        {[
          ["low", `Low / Out of Stock (${data?.lowStock?.length || 0})`],
          ["expired", `Expired (${data?.expired?.length || 0})`],
          ["expiring30", `Expiring ≤ 30d (${data?.expiring30?.length || 0})`],
          ["expiring90", `Expiring 31–90d (${data?.expiring90?.length || 0})`],
        ].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-lg px-3 py-1.5 ${tab === k ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>{l}</button>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        {loading && !data ? <Spinner /> : error ? <ErrorState message={error} onRetry={load} /> : tab === "low" ? (
          data.lowStock.length === 0 ? <EmptyState title="No low stock medicines" message="All active medicines are above their alert level." /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-500">
                  <tr><th className="px-2.5 py-2">Medicine</th><th className="px-2.5 py-2">Category</th><th className="px-2.5 py-2">Supplier</th><th className="px-2.5 py-2 text-right">Available</th><th className="px-2.5 py-2 text-right">Alert Level</th><th className="px-2.5 py-2 text-right">Restock Needed</th><th className="px-2.5 py-2">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.lowStock.map((m) => (
                    <tr key={m.id}>
                      <td className="px-2.5 py-1.5 font-semibold text-slate-900">{m.name} {m.strength || ""}<span className="block text-[11px] font-normal text-slate-400">{m.genericName || ""}</span></td>
                      <td className="px-2.5 py-1.5 text-slate-600">{m.category?.name || "—"}</td>
                      <td className="px-2.5 py-1.5 text-slate-600">{m.defaultSupplier?.name || "—"}</td>
                      <td className={`px-2.5 py-1.5 text-right font-bold tabular-nums ${m.stockStatus === "OUT" ? "text-rose-600" : "text-amber-600"}`}>{Number(m.validStock)} {m.unit}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{Number(m.lowStockAlert)} {m.unit}</td>
                      <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums">{Math.max(0, Number(m.lowStockAlert) - Number(m.validStock))} {m.unit}</td>
                      <td className="px-2.5 py-1.5"><Badge tone={m.stockStatus === "OUT" ? "red" : "amber"}>{m.stockStatus === "OUT" ? "OUT OF STOCK" : "LOW STOCK"}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (() => {
          const rows = tab === "expired" ? data.expired : tab === "expiring30" ? data.expiring30 : data.expiring90;
          if (rows.length === 0) return <EmptyState title="No batches in this expiry window" />;
          return (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-500">
                  <tr><th className="px-2.5 py-2">Medicine</th><th className="px-2.5 py-2">Batch #</th><th className="px-2.5 py-2">Expiry Date</th><th className="px-2.5 py-2 text-right">Stock</th><th className="px-2.5 py-2 text-right">Cost Value</th><th className="px-2.5 py-2">Supplier</th><th className="px-2.5 py-2">State</th>{canAdjust && tab === "expired" && <th className="px-2.5 py-2 text-right">Action</th>}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((b) => (
                    <tr key={b.id} className={tab === "expired" ? "bg-rose-50/40" : ""}>
                      <td className="px-2.5 py-1.5 font-semibold text-slate-900">{b.medicine.name} {b.medicine.strength || ""}</td>
                      <td className="px-2.5 py-1.5 font-mono">{b.batchNumber}</td>
                      <td className="px-2.5 py-1.5 font-semibold">{formatDate(b.expiryDate)}</td>
                      <td className="px-2.5 py-1.5 text-right font-bold tabular-nums">{Number(b.quantity)} {b.medicine.unit}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{formatMoney(Number(b.quantity) * Number(b.purchasePrice))}</td>
                      <td className="px-2.5 py-1.5 text-slate-600">{b.supplier?.name || "—"}</td>
                      <td className="px-2.5 py-1.5">
                        {tab === "expired" ? (
                          <Badge tone="red"><AlertTriangle size={10} className="mr-0.5" /> EXPIRED</Badge>
                        ) : (
                          <Badge tone="amber"><Clock size={10} className="mr-0.5" /> {tab === "expiring30" ? "≤ 30 Days" : "≤ 90 Days"}</Badge>
                        )}
                      </td>
                      {canAdjust && tab === "expired" && (
                        <td className="px-2.5 py-1.5 text-right">
                          <Button variant="danger" size="sm" onClick={() => setWriteOffBatch({ ...b, defaultType: "EXPIRED_WRITE_OFF" })}>
                            <Trash2 size={12} /> Write Off
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

      {writeOffBatch && (
        <StockAdjustmentModal
          initialBatch={writeOffBatch}
          onClose={() => setWriteOffBatch(null)}
          onSaved={() => { setWriteOffBatch(null); load(); }}
        />
      )}
    </div>
  );
}
