"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { api, formatDate, formatDateTime, formatMoney } from "@/lib/client";
import { Badge, Button, Field, FormError, Modal, Select, Spinner, inputClass, useToast } from "@/components/ui";
import { expiryStatusOf } from "@/lib/pharmacy";

export default function BatchManagerModal({ medicineId, canManage, suppliers = [], onClose, onChanged }) {
  const toast = useToast();
  const [med, setMed] = useState(null);
  const [tick, setTick] = useState(0);
  const [loadedTick, setLoadedTick] = useState(-1);
  const loading = loadedTick !== tick;
  const [tab, setTab] = useState("batches"); // "batches" | "audits" | "movements"
  const [showAdd, setShowAdd] = useState(false);
  const [editBatch, setEditBatch] = useState(null);

  const [newBatch, setNewBatch] = useState({ batchNumber: "", expiryDate: "", quantity: "", purchasePrice: "", salePrice: "", supplierId: "", notes: "" });
  const [priceForm, setPriceForm] = useState({ purchasePrice: "", salePrice: "", expiryDate: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let stop = false;
    api(`/api/pharmacy/medicines/${medicineId}`)
      .then((d) => {
        if (stop) return;
        setMed(d);
        setNewBatch((b) => ({
          ...b,
          purchasePrice: b.purchasePrice || String(d.defaultPurchasePrice || 0),
          salePrice: b.salePrice || String(d.defaultSalePrice || 0),
          supplierId: b.supplierId || d.defaultSupplierId || "",
        }));
      })
      .catch((e) => !stop && setError(e.message))
      .finally(() => !stop && setLoadedTick(tick));
    return () => { stop = true; };
  }, [medicineId, tick]);

  async function addBatch(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/pharmacy/batches", {
        method: "POST",
        body: {
          medicineId,
          batchNumber: newBatch.batchNumber.trim(),
          expiryDate: newBatch.expiryDate,
          quantity: Number(newBatch.quantity) || 0,
          purchasePrice: Number(newBatch.purchasePrice) || 0,
          salePrice: Number(newBatch.salePrice) || 0,
          supplierId: newBatch.supplierId || null,
          notes: newBatch.notes.trim() || null,
        },
      });
      toast.success("New batch added.");
      setShowAdd(false);
      setNewBatch({ batchNumber: "", expiryDate: "", quantity: "", purchasePrice: String(med?.defaultPurchasePrice || 0), salePrice: String(med?.defaultSalePrice || 0), supplierId: med?.defaultSupplierId || "", notes: "" });
      load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveBatchEdit(e) {
    e.preventDefault();
    if (busy || !editBatch) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/pharmacy/batches/${editBatch.id}`, {
        method: "PATCH",
        body: {
          purchasePrice: Number(priceForm.purchasePrice),
          salePrice: Number(priceForm.salePrice),
          expiryDate: priceForm.expiryDate,
          reason: priceForm.reason.trim() || null,
        },
      });
      toast.success("Batch pricing updated.");
      setEditBatch(null);
      load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      size="xl"
      title={med ? `${med.name} ${med.strength || ""} — Batches & Audit` : "Medicine Batches"}
      subtitle={med ? `Valid Stock: ${med.validStock} ${med.unit} · Expired: ${med.expiredStock} · Value: ${formatMoney(med.stockValue)}` : undefined}
      onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>Close (Esc)</Button>}
    >
      {loading && !med ? (
        <Spinner />
      ) : (
        <div className="space-y-3">
          <FormError message={error} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
              {[["batches", `Batches (${med?.batches?.length || 0})`], ["movements", "Stock Ledger"], ["audits", "Price Audit"]].map(([k, l]) => (
                <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-md px-2.5 py-1 ${tab === k ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"}`}>{l}</button>
              ))}
            </div>
            {canManage && tab === "batches" && (
              <Button size="sm" onClick={() => setShowAdd((v) => !v)}>
                <Plus size={14} /> Add Batch
              </Button>
            )}
          </div>

          {showAdd && canManage && (
            <form onSubmit={addBatch} className="grid gap-2 rounded-lg border border-blue-200 bg-blue-50/40 p-2.5 sm:grid-cols-6">
              <Field label="Batch #" required><input required value={newBatch.batchNumber} onChange={(e) => setNewBatch({ ...newBatch, batchNumber: e.target.value })} className={inputClass} /></Field>
              <Field label="Expiry" required><input required type="date" value={newBatch.expiryDate} onChange={(e) => setNewBatch({ ...newBatch, expiryDate: e.target.value })} className={inputClass} /></Field>
              <Field label="Quantity" required><input required type="number" min="0" step="any" value={newBatch.quantity} onChange={(e) => setNewBatch({ ...newBatch, quantity: e.target.value })} className={inputClass} /></Field>
              <Field label="Cost (Rs)" required><input required type="number" min="0" step="any" value={newBatch.purchasePrice} onChange={(e) => setNewBatch({ ...newBatch, purchasePrice: e.target.value })} className={inputClass} /></Field>
              <Field label="Sale (Rs)" required><input required type="number" min="0" step="any" value={newBatch.salePrice} onChange={(e) => setNewBatch({ ...newBatch, salePrice: e.target.value })} className={inputClass} /></Field>
              <Field label="Supplier">
                <Select value={newBatch.supplierId} onChange={(e) => setNewBatch({ ...newBatch, supplierId: e.target.value })} className={inputClass}>
                  <option value="">None</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
              <div className="flex justify-end gap-2 sm:col-span-6">
                <Button variant="secondary" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button type="submit" size="sm" loading={busy}>Save Batch</Button>
              </div>
            </form>
          )}

          {editBatch && canManage && (
            <form onSubmit={saveBatchEdit} className="grid gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-2.5 sm:grid-cols-4">
              <Field label={`Cost Price (${editBatch.batchNumber})`} required><input required type="number" min="0" step="any" value={priceForm.purchasePrice} onChange={(e) => setPriceForm({ ...priceForm, purchasePrice: e.target.value })} className={inputClass} /></Field>
              <Field label="Sale Price" required><input required type="number" min="0" step="any" value={priceForm.salePrice} onChange={(e) => setPriceForm({ ...priceForm, salePrice: e.target.value })} className={inputClass} /></Field>
              <Field label="Expiry Date" required><input required type="date" value={priceForm.expiryDate} onChange={(e) => setPriceForm({ ...priceForm, expiryDate: e.target.value })} className={inputClass} /></Field>
              <Field label="Reason"><input value={priceForm.reason} onChange={(e) => setPriceForm({ ...priceForm, reason: e.target.value })} placeholder="Price revision reason" className={inputClass} /></Field>
              <div className="flex justify-end gap-2 sm:col-span-4">
                <Button variant="secondary" size="sm" onClick={() => setEditBatch(null)}>Cancel</Button>
                <Button type="submit" size="sm" loading={busy}>Save Price Update</Button>
              </div>
            </form>
          )}

          {tab === "batches" && (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                  <tr>
                    <th className="px-2.5 py-2">Batch #</th>
                    <th className="px-2.5 py-2">Expiry</th>
                    <th className="px-2.5 py-2 text-right">Stock</th>
                    <th className="px-2.5 py-2 text-right">Purchase Price</th>
                    <th className="px-2.5 py-2 text-right">Sale Price</th>
                    <th className="px-2.5 py-2">Supplier</th>
                    <th className="px-2.5 py-2">State</th>
                    {canManage && <th className="px-2.5 py-2 text-right">Edit</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(med?.batches || []).map((b) => {
                    const st = expiryStatusOf(b.expiryDate);
                    return (
                      <tr key={b.id}>
                        <td className="px-2.5 py-1.5 font-mono font-semibold text-slate-800">{b.batchNumber}</td>
                        <td className="px-2.5 py-1.5">{formatDate(b.expiryDate)}</td>
                        <td className="px-2.5 py-1.5 text-right font-bold tabular-nums">{Number(b.quantity)} {med.unit}</td>
                        <td className="px-2.5 py-1.5 text-right tabular-nums">{formatMoney(b.purchasePrice)}</td>
                        <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums">{formatMoney(b.salePrice)}</td>
                        <td className="px-2.5 py-1.5 text-slate-500">{b.supplier?.name || "—"}</td>
                        <td className="px-2.5 py-1.5">
                          <Badge tone={st === "EXPIRED" ? "red" : st === "NEAR_EXPIRY" ? "amber" : "green"}>{st.replace(/_/g, " ")}</Badge>
                        </td>
                        {canManage && (
                          <td className="px-2.5 py-1.5 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Update price / expiry"
                              onClick={() => {
                                setEditBatch(b);
                                setPriceForm({
                                  purchasePrice: String(b.purchasePrice),
                                  salePrice: String(b.salePrice),
                                  expiryDate: String(b.expiryDate).slice(0, 10),
                                  reason: "",
                                });
                              }}
                            >
                              <Pencil size={13} />
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {(!med?.batches || med.batches.length === 0) && (
                    <tr><td colSpan={canManage ? 8 : 7} className="p-4 text-center text-slate-400">No batches recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === "movements" && (
            <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                  <tr><th className="px-2.5 py-2">Date</th><th className="px-2.5 py-2">Batch</th><th className="px-2.5 py-2">Type</th><th className="px-2.5 py-2 text-right">Change</th><th className="px-2.5 py-2 text-right">After</th><th className="px-2.5 py-2">Reason</th><th className="px-2.5 py-2">By</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(med?.stockMovements || []).map((m) => (
                    <tr key={m.id}>
                      <td className="px-2.5 py-1.5 text-slate-500">{formatDateTime(m.createdAt)}</td>
                      <td className="px-2.5 py-1.5 font-mono">{m.batch?.batchNumber}</td>
                      <td className="px-2.5 py-1.5">{m.type.replace(/_/g, " ")}</td>
                      <td className={`px-2.5 py-1.5 text-right font-bold tabular-nums ${Number(m.quantityChange) >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{Number(m.quantityChange) >= 0 ? `+${Number(m.quantityChange)}` : Number(m.quantityChange)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{Number(m.balanceAfter)}</td>
                      <td className="px-2.5 py-1.5 text-slate-600">{m.reason || m.referenceNo || "—"}</td>
                      <td className="px-2.5 py-1.5 text-slate-500">{m.createdByName}</td>
                    </tr>
                  ))}
                  {(!med?.stockMovements || med.stockMovements.length === 0) && (
                    <tr><td colSpan={7} className="p-4 text-center text-slate-400">No stock movements yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === "audits" && (
            <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                  <tr><th className="px-2.5 py-2">Date</th><th className="px-2.5 py-2">Batch</th><th className="px-2.5 py-2 text-right">Cost</th><th className="px-2.5 py-2 text-right">Sale</th><th className="px-2.5 py-2">Reason</th><th className="px-2.5 py-2">By</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(med?.priceAudits || []).map((a) => (
                    <tr key={a.id}>
                      <td className="px-2.5 py-1.5 text-slate-500">{formatDateTime(a.createdAt)}</td>
                      <td className="px-2.5 py-1.5 font-mono">{a.batch?.batchNumber || "Catalog"}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{formatMoney(a.oldPurchasePrice)} → <b>{formatMoney(a.newPurchasePrice)}</b></td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{formatMoney(a.oldSalePrice)} → <b>{formatMoney(a.newSalePrice)}</b></td>
                      <td className="px-2.5 py-1.5 text-slate-600">{a.reason || "—"}</td>
                      <td className="px-2.5 py-1.5 text-slate-500">{a.changedByName}</td>
                    </tr>
                  ))}
                  {(!med?.priceAudits || med.priceAudits.length === 0) && (
                    <tr><td colSpan={6} className="p-4 text-center text-slate-400">No price changes logged.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
