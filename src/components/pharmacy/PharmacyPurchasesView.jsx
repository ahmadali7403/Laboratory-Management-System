"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Ban, CreditCard, Eye, PackageCheck, Plus, Printer, RefreshCw, RotateCcw, Search } from "lucide-react";
import { api, formatDate, formatMoney } from "@/lib/client";
import { hasModule } from "@/lib/permissions";
import { PHARMACY_PAYMENT_METHODS } from "@/lib/pharmacy";
import { useRecordView } from "@/components/record-view";
import {
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
  StatusBadge,
  inputClass,
  useConfirm,
  useDebounced,
  useToast,
} from "@/components/ui";
import PurchaseForm from "@/components/pharmacy/PurchaseForm";

function PurchaseDetailModal({ purchaseId, canManage, onClose, onChanged }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [purchase, setPurchase] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [showReturn, setShowReturn] = useState(false);

  const load = useCallback(() => {
    api(`/api/pharmacy/purchases/${purchaseId}`)
      .then(setPurchase)
      .catch((e) => setError(e.message));
  }, [purchaseId]);

  useEffect(() => { load(); }, [load]);

  async function act(action) {
    const ok = await confirm({
      title: action === "finalize" ? "Finalize Purchase" : "Cancel Purchase",
      message:
        action === "finalize"
          ? `Finalize ${purchase.purchaseNo} and add all batches to pharmacy stock?`
          : `Cancel purchase ${purchase.purchaseNo}?`,
      confirmLabel: action === "finalize" ? "Finalize & Add Stock" : "Cancel Purchase",
      danger: action === "cancel",
    });
    if (!ok || busy) return;
    setBusy(true);
    try {
      const r = await api(`/api/pharmacy/purchases/${purchaseId}`, { method: "PATCH", body: { action } });
      toast.success(r.message);
      load();
      onChanged();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  function printPurchase() {
    window.open(`/embed/pharmacy/purchase/${purchaseId}`, "_blank");
  }

  const netTotal = purchase ? Math.max(0, Number(purchase.total) - Number(purchase.returnedAmount || 0)) : 0;
  const due = purchase ? Math.max(0, netTotal - Number(purchase.paidAmount)) : 0;

  return (
    <>
      <Modal
        open
        size="xl"
        title={purchase ? `Purchase ${purchase.purchaseNo}` : "Purchase Details"}
        subtitle={purchase ? `${purchase.supplier.name} · ${formatDate(purchase.purchaseDate)}` : undefined}
        onClose={onClose}
        footer={
          purchase && (
            <>
              <Button variant="secondary" onClick={printPurchase}><Printer size={14} /> Invoice</Button>
              {canManage && purchase.status === "FINALIZED" && due > 0 && (
                <Button variant="secondary" onClick={() => setShowPay(true)}><CreditCard size={14} /> Pay Supplier</Button>
              )}
              {canManage && purchase.status === "FINALIZED" && (
                <Button variant="secondary" onClick={() => setShowReturn(true)}><RotateCcw size={14} /> Return Items</Button>
              )}
              {canManage && ["DRAFT", "ORDERED"].includes(purchase.status) && (
                <>
                  <Button variant="danger" loading={busy} onClick={() => act("cancel")}><Ban size={14} /> Cancel</Button>
                  <Button variant="success" loading={busy} onClick={() => act("finalize")}><PackageCheck size={14} /> Finalize &amp; Add Stock</Button>
                </>
              )}
              <Button variant="secondary" onClick={onClose}>Close</Button>
            </>
          )
        }
      >
        {error ? <ErrorState message={error} onRetry={load} /> : !purchase ? <Spinner /> : (
          <div className="space-y-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={purchase.status} />
              <StatusBadge value={purchase.paymentStatus} />
              {purchase.invoiceNo && <span className="text-slate-600">Supplier Inv: <b>{purchase.invoiceNo}</b></span>}
              <span className="ml-auto text-slate-400">Created by {purchase.createdByName}</span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                  <tr><th className="px-2.5 py-1.5">Medicine</th><th className="px-2.5 py-1.5">Batch</th><th className="px-2.5 py-1.5">Expiry</th><th className="px-2.5 py-1.5 text-right">Qty</th><th className="px-2.5 py-1.5 text-right">Returned</th><th className="px-2.5 py-1.5 text-right">Cost</th><th className="px-2.5 py-1.5 text-right">Sale</th><th className="px-2.5 py-1.5 text-right">Line Total</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchase.items.map((i) => (
                    <tr key={i.id}>
                      <td className="px-2.5 py-1.5 font-semibold text-slate-800">{i.medicine.name} {i.medicine.strength || ""}</td>
                      <td className="px-2.5 py-1.5 font-mono">{i.batchNumber}</td>
                      <td className="px-2.5 py-1.5">{formatDate(i.expiryDate)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{Number(i.quantity)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums text-amber-700">{Number(i.returnedQuantity) > 0 ? Number(i.returnedQuantity) : "—"}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{formatMoney(i.purchasePrice)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{formatMoney(i.salePrice)}</td>
                      <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums">{formatMoney(i.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ml-auto max-w-xs space-y-1 rounded-lg bg-slate-50 p-3">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(purchase.subtotal)}</span></div>
              {Number(purchase.discount) > 0 && <div className="flex justify-between"><span>Discount</span><span>- {formatMoney(purchase.discount)}</span></div>}
              {Number(purchase.additionalCharges) > 0 && <div className="flex justify-between"><span>Additional Charges</span><span>+ {formatMoney(purchase.additionalCharges)}</span></div>}
              <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-900"><span>Total</span><span>{formatMoney(purchase.total)}</span></div>
              {Number(purchase.returnedAmount) > 0 && <div className="flex justify-between text-amber-700"><span>Returned</span><span>- {formatMoney(purchase.returnedAmount)}</span></div>}
              <div className="flex justify-between"><span>Paid</span><span>{formatMoney(purchase.paidAmount)}</span></div>
              <div className="flex justify-between font-bold"><span>Balance Payable</span><span className={due > 0 ? "text-rose-600" : ""}>{formatMoney(due)}</span></div>
            </div>
          </div>
        )}
      </Modal>

      {showPay && purchase && (
        <PurchasePayModal
          purchase={purchase}
          due={due}
          onClose={() => setShowPay(false)}
          onSaved={() => { setShowPay(false); load(); onChanged(); }}
        />
      )}

      {showReturn && purchase && (
        <PurchaseReturnModal
          purchase={purchase}
          onClose={() => setShowReturn(false)}
          onSaved={() => { setShowReturn(false); load(); onChanged(); }}
        />
      )}
    </>
  );
}

function PurchasePayModal({ purchase, due, onClose, onSaved }) {
  const toast = useToast();
  const [amount, setAmount] = useState(String(due));
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await api(`/api/pharmacy/purchases/${purchase.id}`, {
        method: "PATCH",
        body: { action: "pay", amount: Number(amount), method, reference: reference.trim() || null },
      });
      toast.success("Purchase payment recorded.");
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open size="sm" title={`Pay Supplier · ${purchase.purchaseNo}`} subtitle={`Remaining due: ${formatMoney(due)}`} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="pur-pay-form" loading={saving}>Record Payment</Button></>}
    >
      <form id="pur-pay-form" onSubmit={submit} className="space-y-3">
        <FormError message={error} />
        <Field label="Amount (Rs)" required><input required type="number" min="0.01" max={due} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} /></Field>
        <Field label="Method"><Select value={method} onChange={(e) => setMethod(e.target.value)} searchable={false} className={inputClass}>{PHARMACY_PAYMENT_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
        <Field label="Reference"><input value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} className={inputClass} /></Field>
      </form>
    </Modal>
  );
}

function PurchaseReturnModal({ purchase, onClose, onSaved }) {
  const toast = useToast();
  const [qtys, setQtys] = useState({});
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    const lines = purchase.items
      .map((i) => ({ purchaseItemId: i.id, quantity: Number(qtys[i.id] || 0) }))
      .filter((x) => x.quantity > 0);
    if (lines.length === 0) return setError("Enter a return quantity for at least one item.");
    setSaving(true);
    setError("");
    try {
      const r = await api(`/api/pharmacy/purchases/${purchase.id}/return`, {
        method: "POST",
        body: { reason: reason.trim() || null, items: lines },
      });
      toast.success(r.message);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open size="lg" title={`Purchase Return · ${purchase.purchaseNo}`} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="pur-ret-form" variant="danger" loading={saving}>Process Return</Button></>}
    >
      <form id="pur-ret-form" onSubmit={submit} className="space-y-3">
        <FormError message={error} />
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
              <tr><th className="px-2.5 py-1.5">Medicine</th><th className="px-2.5 py-1.5">Batch</th><th className="px-2.5 py-1.5 text-right">Purchased</th><th className="px-2.5 py-1.5 text-right">Batch Stock</th><th className="w-28 px-2.5 py-1.5 text-right">Return Qty</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchase.items.map((i) => {
                const maxRet = Math.min(Math.max(0, Number(i.quantity) - Number(i.returnedQuantity)), Number(i.batch?.quantity ?? i.quantity));
                return (
                  <tr key={i.id}>
                    <td className="px-2.5 py-1.5 font-medium">{i.medicine.name}</td>
                    <td className="px-2.5 py-1.5 font-mono">{i.batchNumber}</td>
                    <td className="px-2.5 py-1.5 text-right">{Number(i.quantity) - Number(i.returnedQuantity)}</td>
                    <td className="px-2.5 py-1.5 text-right">{Number(i.batch?.quantity ?? 0)}</td>
                    <td className="px-2.5 py-1.5 text-right">
                      <input type="number" min="0" max={maxRet} step="any" value={qtys[i.id] || ""} onChange={(e) => setQtys({ ...qtys, [i.id]: e.target.value })} placeholder="0" className={`${inputClass} h-7 text-right`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Field label="Return Reason"><input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="Damaged delivery, near expiry, excess..." className={inputClass} /></Field>
      </form>
    </Modal>
  );
}

export default function PharmacyPurchasesView({ scope }) {
  const toast = useToast();
  const confirm = useConfirm();
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const canManage = !scope.isStaff || hasModule(scope.permissions || [], "pharmacy_purchases", true);

  const [q, setQ] = useState("");
  const dq = useDebounced(q, 250);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const [state, setState] = useState({ key: "", error: "", items: [], total: 0, pageSize: 20 });
  const reqKey = `${dq.trim()}|${status}|${page}|${scope.organizationId || ""}|${scope.branchId || ""}|${tick}`;
  const loading = state.key !== reqKey;
  const data = state;
  const error = state.error;
  const [showNew, setShowNew] = useState(() => sp.get("new") === "1" && canManage);
  const [detailId, setDetailId] = useState(null);

  useEffect(() => {
    if (sp.get("new") === "1") {
      router.replace(pathname, { scroll: false });
    }
  }, [sp, router, pathname]);

  const load = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    const qs = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (dq.trim()) qs.set("q", dq.trim());
    if (status) qs.set("status", status);
    api(`/api/pharmacy/purchases?${qs}`, { signal: ctrl.signal })
      .then((d) => setState({ key: reqKey, error: "", ...d }))
      .catch((e) => e.name !== "AbortError" && setState((s) => ({ ...s, key: reqKey, error: e.message })));
    return () => ctrl.abort();
  }, [dq, status, page, reqKey]);

  async function finalizeRow(row) {
    const ok = await confirm({
      title: "Finalize Purchase",
      message: `Finalize ${row.purchaseNo} and add its batches to stock?`,
      confirmLabel: "Finalize",
    });
    if (!ok) return;
    try {
      const r = await api(`/api/pharmacy/purchases/${row.id}`, { method: "PATCH", body: { action: "finalize" } });
      toast.success(r.message);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-2">
      <PageHeader
        title="Pharmacy Purchases & History"
        description="Record supplier purchases with batch & expiry tracking, manage supplier payments, and process returns."
        actions={
          <>
            <Button variant="secondary" onClick={load}><RefreshCw size={15} className={loading ? "animate-spin" : ""} /></Button>
            {canManage && <Button onClick={() => setShowNew(true)}><Plus size={15} /> New Purchase</Button>}
          </>
        }
      />

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-2">
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search purchase #, invoice, supplier..." className={`${inputClass} pl-8`} />
          </div>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} searchable={false} className="sm:w-40">
            <option value="">All statuses</option>
            <option value="FINALIZED">Finalized</option>
            <option value="ORDERED">Ordered</option>
            <option value="DRAFT">Draft</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </div>

        {loading && !data.items.length ? <Spinner /> : error ? <ErrorState message={error} onRetry={load} /> : data.items.length === 0 ? (
          <EmptyState title="No pharmacy purchases yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[12.5px]">
              <thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-500">
                <tr><th className="px-2.5 py-2">Purchase #</th><th className="px-2.5 py-2">Date</th><th className="px-2.5 py-2">Supplier</th><th className="px-2.5 py-2">Items</th><th className="px-2.5 py-2 text-right">Total</th><th className="px-2.5 py-2 text-right">Paid</th><th className="px-2.5 py-2">Status</th><th className="px-2.5 py-2">Payment</th><th className="px-2.5 py-2 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="px-2.5 py-1.5 font-mono font-semibold text-blue-700">{p.purchaseNo}{p.invoiceNo && <span className="block font-sans text-[10px] text-slate-400">Inv: {p.invoiceNo}</span>}</td>
                    <td className="px-2.5 py-1.5">{formatDate(p.purchaseDate)}</td>
                    <td className="px-2.5 py-1.5 font-medium text-slate-800">{p.supplier?.name}</td>
                    <td className="px-2.5 py-1.5 text-slate-500">{p._count?.items || p.items?.length} lines</td>
                    <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums">{formatMoney(p.total)}</td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums">{formatMoney(p.paidAmount)}</td>
                    <td className="px-2.5 py-1.5"><StatusBadge value={p.status} /></td>
                    <td className="px-2.5 py-1.5"><StatusBadge value={p.paymentStatus} /></td>
                    <td className="px-2.5 py-1.5 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="secondary" size="sm" onClick={() => setDetailId(p.id)}><Eye size={13} /> Details</Button>
                        {canManage && ["DRAFT", "ORDERED"].includes(p.status) && (
                          <Button variant="success" size="sm" onClick={() => finalizeRow(p)}><PackageCheck size={13} /> Finalize</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={data.pageSize || 20} total={data.total || 0} onChange={setPage} />
      </div>

      {showNew && <PurchaseForm scope={scope} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />}
      {detailId && <PurchaseDetailModal purchaseId={detailId} canManage={canManage} onClose={() => setDetailId(null)} onChanged={load} />}
    </div>
  );
}
