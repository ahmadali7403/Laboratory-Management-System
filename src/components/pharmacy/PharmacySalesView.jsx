"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Ban, CreditCard, Eye, Plus, Printer, RefreshCw, RotateCcw, Search } from "lucide-react";
import { api, formatDate, formatDateTime, formatMoney } from "@/lib/client";
import { hasModule } from "@/lib/permissions";
import { PHARMACY_PAYMENT_METHODS } from "@/lib/pharmacy";
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
  StatusBadge,
  inputClass,
  useConfirm,
  useDebounced,
  useToast,
} from "@/components/ui";

function SalePayModal({ sale, balance, onClose, onSaved }) {
  const toast = useToast();
  const [amount, setAmount] = useState(String(balance));
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
      await api(`/api/pharmacy/sales/${sale.id}/payments`, {
        method: "POST",
        body: { amount: Number(amount), method, reference: reference.trim() || null },
      });
      toast.success("Payment recorded.");
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open size="sm" title={`Record Payment · ${sale.saleNo}`} subtitle={`Balance due: ${formatMoney(balance)}`} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="sale-pay-form" loading={saving}>Record Payment</Button></>}
    >
      <form id="sale-pay-form" onSubmit={submit} className="space-y-3">
        <FormError message={error} />
        <Field label="Amount (Rs)" required><input required type="number" min="0.01" max={balance} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} /></Field>
        <Field label="Method"><Select value={method} onChange={(e) => setMethod(e.target.value)} searchable={false} className={inputClass}>{PHARMACY_PAYMENT_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
        <Field label="Reference"><input value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} className={inputClass} /></Field>
      </form>
    </Modal>
  );
}

function SaleReturnModal({ sale, onClose, onSaved }) {
  const toast = useToast();
  const [qtys, setQtys] = useState({});
  const [refundMethod, setRefundMethod] = useState("CASH");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    const lines = sale.items
      .map((i) => ({ saleItemId: i.id, quantity: Number(qtys[i.id] || 0) }))
      .filter((x) => x.quantity > 0);
    if (lines.length === 0) return setError("Enter a return quantity for at least one medicine.");
    setSaving(true);
    setError("");
    try {
      const r = await api(`/api/pharmacy/sales/${sale.id}/return`, {
        method: "POST",
        body: { reason: reason.trim() || null, refundMethod, items: lines },
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
    <Modal open size="lg" title={`Sale Return · ${sale.saleNo}`} subtitle="Restores returned medicine quantities back to their original batches." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="sale-ret-form" variant="danger" loading={saving}>Process Return &amp; Restore Stock</Button></>}
    >
      <form id="sale-ret-form" onSubmit={submit} className="space-y-3">
        <FormError message={error} />
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
              <tr><th className="px-2.5 py-1.5">Medicine</th><th className="px-2.5 py-1.5">Batch</th><th className="px-2.5 py-1.5 text-right">Sold</th><th className="px-2.5 py-1.5 text-right">Returnable</th><th className="w-28 px-2.5 py-1.5 text-right">Return Qty</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sale.items.map((i) => {
                const maxRet = Math.max(0, Number(i.quantity) - Number(i.returnedQuantity));
                return (
                  <tr key={i.id}>
                    <td className="px-2.5 py-1.5 font-medium">{i.medicineName}</td>
                    <td className="px-2.5 py-1.5 font-mono">{i.batchNumber}</td>
                    <td className="px-2.5 py-1.5 text-right">{Number(i.quantity)}</td>
                    <td className="px-2.5 py-1.5 text-right font-semibold">{maxRet}</td>
                    <td className="px-2.5 py-1.5 text-right">
                      <input type="number" min="0" max={maxRet} step="any" disabled={maxRet <= 0} value={qtys[i.id] || ""} onChange={(e) => setQtys({ ...qtys, [i.id]: e.target.value })} placeholder="0" className={`${inputClass} h-7 text-right`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Refund Method"><Select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} searchable={false} className={inputClass}>{PHARMACY_PAYMENT_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
          <Field label="Reason"><input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="Customer return / wrong item..." className={inputClass} /></Field>
        </div>
      </form>
    </Modal>
  );
}

function SaleDetailModal({ saleId, canManage, onClose, onChanged }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [sale, setSale] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [showReturn, setShowReturn] = useState(false);

  const load = useCallback(() => {
    api(`/api/pharmacy/sales/${saleId}`)
      .then(setSale)
      .catch((e) => setError(e.message));
  }, [saleId]);

  useEffect(() => { load(); }, [load]);

  async function cancelSale() {
    const ok = await confirm({
      title: "Cancel Pharmacy Sale",
      message: `Cancel sale ${sale.saleNo}? Remaining medicine quantities will be restored to stock.`,
      confirmLabel: "Cancel Sale & Restore Stock",
      danger: true,
    });
    if (!ok || busy) return;
    setBusy(true);
    try {
      const r = await api(`/api/pharmacy/sales/${saleId}`, { method: "PATCH", body: { action: "cancel" } });
      toast.success(r.message);
      load();
      onChanged();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  const balance = sale ? Math.max(0, Number(sale.total) - Number(sale.paidAmount)) : 0;

  return (
    <>
      <Modal
        open
        size="xl"
        title={sale ? `Sale ${sale.saleNo}` : "Sale Details"}
        subtitle={sale ? `${sale.patient?.name || sale.customerName} · ${formatDateTime(sale.createdAt)}` : undefined}
        onClose={onClose}
        footer={
          sale && (
            <>
              <Button variant="secondary" onClick={() => window.open(`/embed/pharmacy/invoice/${sale.id}`, "_blank")}><Printer size={14} /> Print Invoice</Button>
              {canManage && sale.status !== "CANCELLED" && sale.status !== "RETURNED" && balance > 0 && (
                <Button onClick={() => setShowPay(true)}><CreditCard size={14} /> Collect Balance</Button>
              )}
              {canManage && ["COMPLETED", "PARTIAL_RETURN"].includes(sale.status) && (
                <Button variant="secondary" onClick={() => setShowReturn(true)}><RotateCcw size={14} /> Return</Button>
              )}
              {canManage && sale.status === "COMPLETED" && (
                <Button variant="danger" loading={busy} onClick={cancelSale}><Ban size={14} /> Cancel Sale</Button>
              )}
              <Button variant="secondary" onClick={onClose}>Close</Button>
            </>
          )
        }
      >
        {error ? <ErrorState message={error} onRetry={load} /> : !sale ? <Spinner /> : (
          <div className="space-y-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={sale.status} />
              <StatusBadge value={sale.paymentStatus} />
              <Badge tone={sale.isWalkIn ? "gray" : "blue"}>{sale.isWalkIn ? "Walk-in" : "Registered"}</Badge>
              <span className="ml-auto text-slate-400">Cashier: {sale.soldByName}</span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                  <tr><th className="px-2.5 py-1.5">Medicine</th><th className="px-2.5 py-1.5">Batch</th><th className="px-2.5 py-1.5">Expiry</th><th className="px-2.5 py-1.5 text-right">Qty</th><th className="px-2.5 py-1.5 text-right">Returned</th><th className="px-2.5 py-1.5 text-right">Rate</th><th className="px-2.5 py-1.5 text-right">Disc</th><th className="px-2.5 py-1.5 text-right">Total</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sale.items.map((i) => (
                    <tr key={i.id}>
                      <td className="px-2.5 py-1.5 font-semibold text-slate-800">{i.medicineName} {i.strength || ""}</td>
                      <td className="px-2.5 py-1.5 font-mono">{i.batchNumber}</td>
                      <td className="px-2.5 py-1.5">{formatDate(i.expiryDate)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{Number(i.quantity)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums text-amber-700">{Number(i.returnedQuantity) > 0 ? Number(i.returnedQuantity) : "—"}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{formatMoney(i.unitPrice)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{Number(i.discount) > 0 ? formatMoney(i.discount) : "—"}</td>
                      <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums">{formatMoney(i.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ml-auto max-w-xs space-y-1 rounded-lg bg-slate-50 p-3">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(sale.subtotal)}</span></div>
              {Number(sale.itemDiscountTotal) > 0 && <div className="flex justify-between"><span>Item Discounts</span><span>- {formatMoney(sale.itemDiscountTotal)}</span></div>}
              {Number(sale.discount) > 0 && <div className="flex justify-between"><span>Bill Discount</span><span>- {formatMoney(sale.discount)}</span></div>}
              <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-900"><span>Grand Total</span><span>{formatMoney(sale.total)}</span></div>
              <div className="flex justify-between"><span>Paid</span><span>{formatMoney(sale.paidAmount)}</span></div>
              {Number(sale.refundedAmount) > 0 && <div className="flex justify-between text-rose-600"><span>Refunded</span><span>{formatMoney(sale.refundedAmount)}</span></div>}
              <div className="flex justify-between font-bold"><span>Balance</span><span className={balance > 0 ? "text-rose-600" : ""}>{formatMoney(balance)}</span></div>
            </div>

            {sale.payments.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase text-slate-500">Payments</p>
                <div className="divide-y divide-slate-100 rounded border border-slate-200">
                  {sale.payments.map((p) => (
                    <div key={p.id} className="flex justify-between px-2.5 py-1.5">
                      <span>{formatDateTime(p.createdAt)} · {p.method.replace("_", " ")}{p.reference ? ` · ${p.reference}` : ""}</span>
                      <b className={Number(p.amount) < 0 ? "text-rose-600" : ""}>{formatMoney(p.amount)}</b>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {showPay && sale && <SalePayModal sale={sale} balance={balance} onClose={() => setShowPay(false)} onSaved={() => { setShowPay(false); load(); onChanged(); }} />}
      {showReturn && sale && <SaleReturnModal sale={sale} onClose={() => setShowReturn(false)} onSaved={() => { setShowReturn(false); load(); onChanged(); }} />}
    </>
  );
}

export default function PharmacySalesView({ scope }) {
  const canManage = !scope.isStaff || hasModule(scope.permissions || [], "pharmacy_pos", true);
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 250);
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const [state, setState] = useState({ key: "", error: "", items: [], total: 0, pageSize: 20 });
  const reqKey = `${dq.trim()}|${status}|${paymentStatus}|${page}|${scope.organizationId || ""}|${scope.branchId || ""}|${tick}`;
  const loading = state.key !== reqKey;
  const data = state;
  const error = state.error;
  const [detailId, setDetailId] = useState(null);

  const load = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    const sp = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (dq.trim()) sp.set("q", dq.trim());
    if (status) sp.set("status", status);
    if (paymentStatus) sp.set("paymentStatus", paymentStatus);
    api(`/api/pharmacy/sales?${qsToString(sp)}`, { signal: ctrl.signal })
      .then((d) => setState({ key: reqKey, error: "", ...d }))
      .catch((e) => e.name !== "AbortError" && setState((s) => ({ ...s, key: reqKey, error: e.message })));
    return () => ctrl.abort();
  }, [dq, status, paymentStatus, page, reqKey]);

  return (
    <div className="space-y-2">
      <PageHeader
        title="Pharmacy Sales"
        description="View pharmacy invoices, collect remaining balances, print receipts, and handle returns."
        actions={
          <>
            <Button variant="secondary" onClick={load}><RefreshCw size={15} className={loading ? "animate-spin" : ""} /></Button>
            {canManage && (
              <Link href="/pharmacy/pos" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[13px] font-semibold text-white shadow-sm hover:bg-emerald-700">
                <Plus size={15} /> Open Pharmacy POS
              </Link>
            )}
          </>
        }
      />

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-2">
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search sale #, customer, phone..." className={`${inputClass} pl-8`} />
          </div>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} searchable={false} className="sm:w-40">
            <option value="">All statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="PARTIAL_RETURN">Partial Return</option>
            <option value="RETURNED">Returned</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
          <Select value={paymentStatus} onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }} searchable={false} className="sm:w-40">
            <option value="">All payments</option>
            <option value="PAID">Paid</option>
            <option value="PARTIAL">Partial</option>
            <option value="UNPAID">Unpaid</option>
          </Select>
        </div>

        {loading && !data.items.length ? <Spinner /> : error ? <ErrorState message={error} onRetry={load} /> : data.items.length === 0 ? (
          <EmptyState title="No pharmacy sales yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[12.5px]">
              <thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-500">
                <tr><th className="px-2.5 py-2">Sale #</th><th className="px-2.5 py-2">Date</th><th className="px-2.5 py-2">Customer</th><th className="px-2.5 py-2">Items</th><th className="px-2.5 py-2 text-right">Total</th><th className="px-2.5 py-2 text-right">Paid</th><th className="px-2.5 py-2">Status</th><th className="px-2.5 py-2">Payment</th><th className="px-2.5 py-2 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <td className="px-2.5 py-1.5 font-mono font-semibold text-emerald-700">{s.saleNo}</td>
                    <td className="px-2.5 py-1.5 text-xs text-slate-500">{formatDateTime(s.createdAt)}</td>
                    <td className="px-2.5 py-1.5 font-medium text-slate-800">{s.patient?.name || s.customerName}{s.customerPhone ? <span className="block text-[10.5px] text-slate-400">{s.customerPhone}</span> : ""}</td>
                    <td className="px-2.5 py-1.5 text-slate-500">{s._count?.items || 0}</td>
                    <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums">{formatMoney(s.total)}</td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums">{formatMoney(s.paidAmount)}</td>
                    <td className="px-2.5 py-1.5"><StatusBadge value={s.status} /></td>
                    <td className="px-2.5 py-1.5"><StatusBadge value={s.paymentStatus} /></td>
                    <td className="px-2.5 py-1.5 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="secondary" size="sm" onClick={() => setDetailId(s.id)}><Eye size={13} /> View</Button>
                        <Button variant="secondary" size="sm" onClick={() => window.open(`/embed/pharmacy/invoice/${s.id}`, "_blank")}><Printer size={13} /></Button>
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

      {detailId && <SaleDetailModal saleId={detailId} canManage={canManage} onClose={() => setDetailId(null)} onChanged={load} />}
    </div>
  );
}

const qsToString = (sp) => sp.toString();
