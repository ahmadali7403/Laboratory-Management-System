"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Printer, RefreshCw } from "lucide-react";
import { api, formatDate, formatDateTime, formatMoney } from "@/lib/client";
import { PHARMACY_REPORT_TYPES } from "@/lib/pharmacy";
import { downloadText, printTable } from "@/components/data-tools";
import { Button, EmptyState, ErrorState, PageHeader, Select, Spinner, inputClass } from "@/components/ui";

function formatCell(val, col) {
  if (val == null || val === "") return "—";
  if (col === "Date" || col === "Expiry") {
    return String(val).includes("T") && col === "Date" ? formatDateTime(val) : formatDate(val);
  }
  if (["Subtotal", "Discount", "Total", "Paid", "Refunded", "Purchase Value", "Retail Value", "Cost Value", "Revenue", "Cost", "Profit", "Total Purchased", "Paid on Purchases", "Payable Balance", "Old Cost", "New Cost", "Old Sale", "New Sale"].includes(col)) {
    return typeof val === "number" ? formatMoney(val) : val;
  }
  return String(val);
}

export default function PharmacyReportsView({ scope }) {
  const [type, setType] = useState("sales");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tick, setTick] = useState(0);
  const [state, setState] = useState({ key: "", data: null, error: "" });
  const reqKey = `${type}|${from}|${to}|${scope.organizationId || ""}|${scope.branchId || ""}|${tick}`;
  const loading = state.key !== reqKey;
  const { data, error } = state;

  const load = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    const sp = new URLSearchParams({ type });
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    api(`/api/pharmacy/reports?${sp}`, { signal: ctrl.signal })
      .then((d) => setState({ key: reqKey, data: d, error: "" }))
      .catch((e) => e.name !== "AbortError" && setState((s) => ({ ...s, key: reqKey, error: e.message })));
    return () => ctrl.abort();
  }, [type, from, to, reqKey]);

  function exportCsv() {
    if (!data?.rows?.length) return;
    const cols = data.columns;
    const csvCell = (v) => {
      const s = v == null ? "" : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [cols.map(csvCell).join(","), ...data.rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))];
    downloadText(`pharmacy-${type}-${new Date().toISOString().slice(0, 10)}.csv`, lines.join("\r\n"));
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="Pharmacy Reports"
        description="Operational, financial, stock valuation, expiry, supplier, and audit reports."
        actions={
          <>
            <Button variant="secondary" onClick={load}><RefreshCw size={15} className={loading ? "animate-spin" : ""} /></Button>
            <Button variant="secondary" disabled={!data?.rows?.length} onClick={exportCsv}><Download size={15} /> Export CSV</Button>
            <Button variant="secondary" disabled={!data?.rows?.length} onClick={() => printTable(data.title, data.rows)}><Printer size={15} /> Print</Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
        <Select value={type} onChange={(e) => setType(e.target.value)} searchable={false} className="sm:w-64">
          {PHARMACY_REPORT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </Select>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={`${inputClass} w-36`} aria-label="From date" />
          <span>to</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={`${inputClass} w-36`} aria-label="To date" />
          {(from || to) && <Button variant="ghost" size="sm" onClick={() => { setFrom(""); setTo(""); }}>Clear</Button>}
        </div>
      </div>

      {loading && !data ? <Spinner /> : error ? <ErrorState message={error} onRetry={load} /> : data && (
        <>
          {data.summary?.length > 0 && (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
              {data.summary.map((s) => (
                <div key={s.label} className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{s.label}</p>
                  <p className="mt-0.5 text-base font-extrabold text-slate-900 tabular-nums">
                    {s.kind === "m" ? formatMoney(s.value) : Number(s.value).toLocaleString("en-PK")}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            {data.rows.length === 0 ? (
              <EmptyState title="No records for this report" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12.5px]">
                  <thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-500">
                    <tr>{data.columns.map((c) => <th key={c} className="px-2.5 py-2">{c}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.rows.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50/60">
                        {data.columns.map((c) => <td key={c} className="px-2.5 py-1.5">{formatCell(r[c], c)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
