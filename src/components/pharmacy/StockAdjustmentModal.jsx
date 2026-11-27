"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpDown, Plus, RefreshCw, Search } from "lucide-react";
import { api, formatDate, formatDateTime } from "@/lib/client";
import { hasModule } from "@/lib/permissions";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  FormError,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Spinner,
  inputClass,
  useDebounced,
  useToast,
} from "@/components/ui";

export function StockAdjustmentModal({ initialBatch = null, onClose, onSaved }) {
  const toast = useToast();
  const [batches, setBatches] = useState([]);
  const [batchQ, setBatchQ] = useState("");
  const dq = useDebounced(batchQ, 200);
  const [batchId, setBatchId] = useState(initialBatch?.id || "");
  const [adjustmentType, setAdjustmentType] = useState(initialBatch?.defaultType || "DECREASE");
  const [direction, setDirection] = useState("SUBTRACT");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/api/pharmacy/batches?pageSize=60&q=${encodeURIComponent(dq)}`)
      .then((d) => setBatches(d.items || []))
      .catch(() => {});
  }, [dq]);

  const allBatches = initialBatch && !batches.some((b) => b.id === initialBatch.id) ? [initialBatch, ...batches] : batches;

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await api("/api/pharmacy/stock", {
        method: "POST",
        body: {
          batchId,
          adjustmentType,
          ...(adjustmentType === "CORRECTION" ? { direction } : {}),
          quantity: Number(quantity),
          reason: reason.trim(),
        },
      });
      toast.success("Stock adjustment recorded.");
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      size="md"
      title="Stock Adjustment"
      subtitle="Adjust batch quantity with full audit trail. Negative stock is prevented."
      onClose={saving ? undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="adj-form" loading={saving}>Apply Adjustment</Button>
        </>
      }
    >
      <form id="adj-form" onSubmit={submit} className="space-y-3">
        <FormError message={error} />
        <Field label="Batch" required>
          <Select required value={batchId} onChange={(e) => setBatchId(e.target.value)} onSearch={setBatchQ} className={inputClass}>
            <option value="">Select medicine batch...</option>
            {allBatches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.medicine?.name} · Batch {b.batchNumber} · Exp {formatDate(b.expiryDate)} · Stock {Number(b.quantity)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Adjustment Type" required>
            <Select value={adjustmentType} onChange={(e) => setAdjustmentType(e.target.value)} searchable={false} className={inputClass}>
              <option value="INCREASE">Increase (+)</option>
              <option value="DECREASE">Decrease (-)</option>
              <option value="DAMAGED">Damaged (-)</option>
              <option value="EXPIRED_WRITE_OFF">Expired Write-off (-)</option>
              <option value="CORRECTION">Stock Correction</option>
            </Select>
          </Field>
          {adjustmentType === "CORRECTION" && (
            <Field label="Correction Direction" required>
              <Select value={direction} onChange={(e) => setDirection(e.target.value)} searchable={false} className={inputClass}>
                <option value="ADD">Add (+)</option>
                <option value="SUBTRACT">Subtract (-)</option>
              </Select>
            </Field>
          )}
          <Field label="Quantity" required>
            <input required type="number" min="0.01" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label="Reason" required>
          <textarea required rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Physical count mismatch, broken bottle, expired disposal..." className={`${inputClass} h-auto py-1.5`} />
        </Field>
      </form>
    </Modal>
  );
}

export default function PharmacyStockView({ scope }) {
  const canAdjust = !scope.isStaff || hasModule(scope.permissions || [], "pharmacy_inventory", true) || hasModule(scope.permissions || [], "pharmacy", true);
  const [tab, setTab] = useState("batches"); // "batches" | "adjustments" | "movements"
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 250);
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const [state, setState] = useState({ key: "", error: "", items: [], total: 0, pageSize: 25 });
  const reqKey = `${tab}|${dq.trim()}|${page}|${scope.organizationId || ""}|${scope.branchId || ""}|${tick}`;
  const loading = state.key !== reqKey;
  const data = state;
  const error = state.error;
  const [adjustBatch, setAdjustBatch] = useState(null);

  const load = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    const sp = new URLSearchParams({ page: String(page), pageSize: "25" });
    if (dq.trim()) sp.set("q", dq.trim());
    const url = tab === "batches" ? `/api/pharmacy/batches?${sp}` : `/api/pharmacy/stock?view=${tab}&${sp}`;
    api(url, { signal: ctrl.signal })
      .then((d) => setState({ key: reqKey, error: "", ...d }))
      .catch((e) => e.name !== "AbortError" && setState((s) => ({ ...s, key: reqKey, error: e.message })));
    return () => ctrl.abort();
  }, [tab, dq, page, reqKey]);

  return (
    <div className="space-y-2">
      <PageHeader
        title="Stock Management & Adjustments"
        description="Inspect batch-level stock, audit stock adjustments, and trace every inventory movement."
        actions={
          <>
            <Button variant="secondary" onClick={load}><RefreshCw size={15} className={loading ? "animate-spin" : ""} /></Button>
            {canAdjust && <Button onClick={() => setAdjustBatch({})}><Plus size={15} /> New Stock Adjustment</Button>}
          </>
        }
      />

      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 text-xs font-semibold">
        {[["batches", "Batch Stock"], ["adjustments", "Stock Adjustments"], ["movements", "Movement Ledger"]].map(([k, l]) => (
          <button key={k} type="button" onClick={() => { setTab(k); setPage(1); }} className={`rounded-lg px-3 py-1.5 ${tab === k ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>{l}</button>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-2">
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search medicine, batch or reason..." className={`${inputClass} pl-8`} />
          </div>
        </div>

        {loading && !data.items.length ? (
          <Spinner />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : data.items.length === 0 ? (
          <EmptyState title="No records found" />
        ) : tab === "batches" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-500">
                <tr><th className="px-2.5 py-2">Medicine</th><th className="px-2.5 py-2">Batch</th><th className="px-2.5 py-2">Expiry</th><th className="px-2.5 py-2 text-right">Initial</th><th className="px-2.5 py-2 text-right">Current</th><th className="px-2.5 py-2">Supplier</th>{canAdjust && <th className="px-2.5 py-2 text-right">Adjust</th>}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((b) => (
                  <tr key={b.id}>
                    <td className="px-2.5 py-1.5 font-semibold text-slate-800">{b.medicine?.name} {b.medicine?.strength || ""}</td>
                    <td className="px-2.5 py-1.5 font-mono">{b.batchNumber}</td>
                    <td className="px-2.5 py-1.5">{formatDate(b.expiryDate)}</td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums text-slate-500">{Number(b.initialQuantity)}</td>
                    <td className="px-2.5 py-1.5 text-right font-bold tabular-nums">{Number(b.quantity)} {b.medicine?.unit}</td>
                    <td className="px-2.5 py-1.5 text-slate-500">{b.supplier?.name || "—"}</td>
                    {canAdjust && (
                      <td className="px-2.5 py-1.5 text-right">
                        <Button variant="secondary" size="sm" onClick={() => setAdjustBatch(b)}><ArrowUpDown size={12} /> Adjust</Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === "adjustments" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-500">
                <tr><th className="px-2.5 py-2">Date</th><th className="px-2.5 py-2">Medicine</th><th className="px-2.5 py-2">Batch</th><th className="px-2.5 py-2">Type</th><th className="px-2.5 py-2 text-right">Qty</th><th className="px-2.5 py-2 text-right">Before → After</th><th className="px-2.5 py-2">Reason</th><th className="px-2.5 py-2">By</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((a) => (
                  <tr key={a.id}>
                    <td className="px-2.5 py-1.5 text-xs text-slate-500">{formatDateTime(a.createdAt)}</td>
                    <td className="px-2.5 py-1.5 font-semibold text-slate-800">{a.medicine?.name}</td>
                    <td className="px-2.5 py-1.5 font-mono text-xs">{a.batch?.batchNumber}</td>
                    <td className="px-2.5 py-1.5"><Badge tone={a.adjustmentType === "INCREASE" ? "green" : "amber"}>{a.adjustmentType.replace(/_/g, " ")}</Badge></td>
                    <td className="px-2.5 py-1.5 text-right font-bold tabular-nums">{Number(a.quantity)}</td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums">{Number(a.previousStock)} → <b>{Number(a.newStock)}</b></td>
                    <td className="px-2.5 py-1.5 text-slate-600">{a.reason}</td>
                    <td className="px-2.5 py-1.5 text-slate-500">{a.adjustedByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-500">
                <tr><th className="px-2.5 py-2">Date</th><th className="px-2.5 py-2">Medicine</th><th className="px-2.5 py-2">Batch</th><th className="px-2.5 py-2">Movement</th><th className="px-2.5 py-2 text-right">Change</th><th className="px-2.5 py-2 text-right">Balance</th><th className="px-2.5 py-2">Reference / Reason</th><th className="px-2.5 py-2">By</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((m) => (
                  <tr key={m.id}>
                    <td className="px-2.5 py-1.5 text-xs text-slate-500">{formatDateTime(m.createdAt)}</td>
                    <td className="px-2.5 py-1.5 font-semibold text-slate-800">{m.medicine?.name}</td>
                    <td className="px-2.5 py-1.5 font-mono text-xs">{m.batch?.batchNumber}</td>
                    <td className="px-2.5 py-1.5 text-xs">{m.type.replace(/_/g, " ")}</td>
                    <td className={`px-2.5 py-1.5 text-right font-bold tabular-nums ${Number(m.quantityChange) >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{Number(m.quantityChange) >= 0 ? `+${Number(m.quantityChange)}` : Number(m.quantityChange)}</td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums">{Number(m.balanceBefore)} → <b>{Number(m.balanceAfter)}</b></td>
                    <td className="px-2.5 py-1.5 text-slate-600">{m.reason || m.referenceNo || "—"}</td>
                    <td className="px-2.5 py-1.5 text-slate-500">{m.createdByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={data.pageSize || 25} total={data.total || 0} onChange={setPage} />
      </div>

      {adjustBatch !== null && (
        <StockAdjustmentModal
          initialBatch={adjustBatch.id ? adjustBatch : null}
          onClose={() => setAdjustBatch(null)}
          onSaved={() => { setAdjustBatch(null); load(); }}
        />
      )}
    </div>
  );
}
