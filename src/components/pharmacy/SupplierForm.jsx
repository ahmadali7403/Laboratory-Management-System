"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Eye, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
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

export function SupplierFormModal({ scope, supplier = null, onClose, onSaved }) {
  const toast = useToast();
  const isNew = !supplier;
  const showBranch = isNew && scope.role !== "BRANCH_ADMIN" && !scope.branchId;
  const [branchId, setBranchId] = useState("");
  const [form, setForm] = useState({
    name: supplier?.name || "",
    contactPerson: supplier?.contactPerson || "",
    phone: supplier?.phone || "",
    email: supplier?.email || "",
    address: supplier?.address || "",
    isActive: supplier?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await api(isNew ? "/api/pharmacy/suppliers" : `/api/pharmacy/suppliers/${supplier.id}`, {
        method: isNew ? "POST" : "PATCH",
        body: {
          ...(showBranch ? { branchId: branchId || null } : {}),
          name: form.name.trim(),
          contactPerson: form.contactPerson.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          address: form.address.trim() || null,
          isActive: form.isActive,
        },
      });
      toast.success(isNew ? "Supplier created." : "Supplier updated.");
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open size="md" title={isNew ? "New Supplier" : `Edit Supplier · ${supplier.name}`} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="sup-form" loading={saving}>Save</Button></>}
    >
      <form id="sup-form" onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><FormError message={error} /></div>
        {showBranch && (
          <Field label="Available to" className="sm:col-span-2">
            <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputClass}>
              <option value="">All branches (organization-wide)</option>
              {scope.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Supplier Name" required><input required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} /></Field>
        <Field label="Contact Person"><input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} className={inputClass} /></Field>
        <Field label="Phone"><input value={form.phone} placeholder="03XXXXXXXXX" onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} /></Field>
        <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} /></Field>
        <Field label="Address" className="sm:col-span-2"><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputClass} /></Field>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 sm:col-span-2">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4 rounded border-slate-300" /> Active
        </label>
      </form>
    </Modal>
  );
}

function SupplierPaymentModal({ scope, supplier, onClose, onSaved }) {
  const toast = useToast();
  const needsPick = scope.role !== "BRANCH_ADMIN" && !scope.branchId;
  const [branchId, setBranchId] = useState(scope.branchId || "");
  const [amount, setAmount] = useState(String(Math.max(0, Number(supplier.pharmacyBalance || 0))));
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await api(`/api/pharmacy/suppliers/${supplier.id}/payments`, {
        method: "POST",
        body: {
          ...(needsPick ? { branchId } : {}),
          amount: Number(amount),
          method,
          reference: reference.trim() || null,
          notes: notes.trim() || null,
        },
      });
      toast.success("Supplier payment recorded.");
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open size="sm" title={`Pay Supplier · ${supplier.name}`} subtitle={`Current payable balance: ${formatMoney(supplier.pharmacyBalance)}`} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="sup-pay-form" loading={saving}>Record Payment</Button></>}
    >
      <form id="sup-pay-form" onSubmit={submit} className="space-y-3">
        <FormError message={error} />
        {needsPick && (
          <Field label="Branch" required>
            <Select required value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputClass}>
              <option value="">Select branch</option>
              {scope.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Amount (Rs)" required><input required type="number" min="0.01" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} /></Field>
        <Field label="Method"><Select value={method} onChange={(e) => setMethod(e.target.value)} searchable={false} className={inputClass}>{PHARMACY_PAYMENT_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
        <Field label="Reference"><input value={reference} onChange={(e) => setReference(e.target.value)} className={inputClass} /></Field>
        <Field label="Notes"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} /></Field>
      </form>
    </Modal>
  );
}

function SupplierDetailModal({ supplierId, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api(`/api/pharmacy/suppliers/${supplierId}`).then(setData).catch((e) => setError(e.message));
  }, [supplierId]);

  return (
    <Modal open size="lg" title={data ? `Supplier · ${data.name}` : "Supplier Details"} onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      {error ? <ErrorState message={error} /> : !data ? <Spinner /> : (
        <div className="space-y-3 text-xs">
          <div className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-3">
            <div><span className="text-slate-400">Contact:</span> <b>{data.contactPerson || "—"}</b></div>
            <div><span className="text-slate-400">Phone:</span> <b>{data.phone || "—"}</b></div>
            <div><span className="text-slate-400">Payable Balance:</span> <b className={Number(data.pharmacyBalance) > 0 ? "text-rose-600" : "text-emerald-700"}>{formatMoney(data.pharmacyBalance)}</b></div>
          </div>
          <div>
            <p className="mb-1 font-bold uppercase text-slate-500">Pharmacy Purchases ({data.pharmacyPurchases.length})</p>
            <div className="max-h-44 overflow-y-auto rounded border border-slate-200">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="px-2 py-1">No</th><th className="px-2 py-1">Date</th><th className="px-2 py-1 text-right">Total</th><th className="px-2 py-1 text-right">Paid</th><th className="px-2 py-1">Status</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.pharmacyPurchases.map((p) => (
                    <tr key={p.id}><td className="px-2 py-1 font-mono font-semibold">{p.purchaseNo}</td><td className="px-2 py-1">{formatDate(p.purchaseDate)}</td><td className="px-2 py-1 text-right">{formatMoney(p.total)}</td><td className="px-2 py-1 text-right">{formatMoney(p.paidAmount)}</td><td className="px-2 py-1"><StatusBadge value={p.status} /></td></tr>
                  ))}
                  {data.pharmacyPurchases.length === 0 && <tr><td colSpan={5} className="p-3 text-center text-slate-400">No purchases yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <p className="mb-1 font-bold uppercase text-slate-500">Supplier Payments ({data.pharmacySupplierPayments.length})</p>
            <div className="max-h-40 overflow-y-auto rounded border border-slate-200">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="px-2 py-1">Date</th><th className="px-2 py-1">Method</th><th className="px-2 py-1">Purchase</th><th className="px-2 py-1 text-right">Amount</th><th className="px-2 py-1">By</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.pharmacySupplierPayments.map((p) => (
                    <tr key={p.id}><td className="px-2 py-1">{formatDateTime(p.createdAt)}</td><td className="px-2 py-1">{p.method}</td><td className="px-2 py-1 font-mono">{p.purchase?.purchaseNo || "Account"}</td><td className="px-2 py-1 text-right font-semibold">{formatMoney(p.amount)}</td><td className="px-2 py-1">{p.paidByName}</td></tr>
                  ))}
                  {data.pharmacySupplierPayments.length === 0 && <tr><td colSpan={5} className="p-3 text-center text-slate-400">No payments yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function PharmacySuppliersView({ scope }) {
  const toast = useToast();
  const confirm = useConfirm();
  const canManage = !scope.isStaff || hasModule(scope.permissions || [], "pharmacy_suppliers", true);

  const [q, setQ] = useState("");
  const dq = useDebounced(q, 250);
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const [state, setState] = useState({ key: "", error: "", items: [], total: 0, pageSize: 20 });
  const reqKey = `${dq.trim()}|${page}|${scope.organizationId || ""}|${scope.branchId || ""}|${tick}`;
  const loading = state.key !== reqKey;
  const data = state;
  const error = state.error;
  const [formSup, setFormSup] = useState(null);
  const [paySup, setPaySup] = useState(null);
  const [viewId, setViewId] = useState(null);

  const load = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    const sp = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (dq.trim()) sp.set("q", dq.trim());
    api(`/api/pharmacy/suppliers?${sp}`, { signal: ctrl.signal })
      .then((d) => setState({ key: reqKey, error: "", ...d }))
      .catch((e) => e.name !== "AbortError" && setState((s) => ({ ...s, key: reqKey, error: e.message })));
    return () => ctrl.abort();
  }, [dq, page, reqKey]);

  async function remove(row) {
    const ok = await confirm({ title: "Delete Supplier", message: `Delete "${row.name}"?`, confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      const r = await api(`/api/pharmacy/suppliers/${row.id}`, { method: "DELETE" });
      toast.success(r.message);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-2">
      <PageHeader
        title="Pharmacy Suppliers"
        description="Manage medicine suppliers, view payable balances, and record supplier payments."
        actions={
          <>
            <Button variant="secondary" onClick={load}><RefreshCw size={15} className={loading ? "animate-spin" : ""} /></Button>
            {canManage && <Button onClick={() => setFormSup({})}><Plus size={15} /> Add Supplier</Button>}
          </>
        }
      />

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-2">
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search supplier name, contact, phone..." className={`${inputClass} pl-8`} />
          </div>
        </div>
        {loading && !data.items.length ? <Spinner /> : error ? <ErrorState message={error} onRetry={load} /> : data.items.length === 0 ? (
          <EmptyState title="No suppliers found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-500">
                <tr><th className="px-2.5 py-2">Supplier</th><th className="px-2.5 py-2">Contact</th><th className="px-2.5 py-2">Phone</th><th className="px-2.5 py-2">Scope</th><th className="px-2.5 py-2 text-right">Payable Balance</th><th className="px-2.5 py-2">Status</th><th className="px-2.5 py-2 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <td className="px-2.5 py-1.5 font-semibold text-slate-900">{s.name}</td>
                    <td className="px-2.5 py-1.5 text-slate-600">{s.contactPerson || "—"}</td>
                    <td className="px-2.5 py-1.5 text-slate-600">{s.phone || "—"}</td>
                    <td className="px-2.5 py-1.5">{s.branch?.name || <Badge tone="violet">All branches</Badge>}</td>
                    <td className={`px-2.5 py-1.5 text-right font-bold tabular-nums ${Number(s.pharmacyBalance) > 0 ? "text-rose-600" : "text-slate-700"}`}>{formatMoney(s.pharmacyBalance)}</td>
                    <td className="px-2.5 py-1.5"><StatusBadge value={s.isActive ? "ACTIVE" : "INACTIVE"} /></td>
                    <td className="px-2.5 py-1.5 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="secondary" size="sm" onClick={() => setViewId(s.id)}><Eye size={13} /> Ledger</Button>
                        {canManage && <Button variant="secondary" size="sm" onClick={() => setPaySup(s)}><CreditCard size={13} /> Pay</Button>}
                        {canManage && (scope.role !== "BRANCH_ADMIN" || s.branchId !== null) && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => setFormSup(s)}><Pencil size={14} /></Button>
                            <Button variant="ghost" size="icon" className="text-rose-500" onClick={() => remove(s)}><Trash2 size={14} /></Button>
                          </>
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

      {formSup !== null && <SupplierFormModal scope={scope} supplier={formSup.id ? formSup : null} onClose={() => setFormSup(null)} onSaved={() => { setFormSup(null); load(); }} />}
      {paySup && <SupplierPaymentModal scope={scope} supplier={paySup} onClose={() => setPaySup(null)} onSaved={() => { setPaySup(null); load(); }} />}
      {viewId && <SupplierDetailModal supplierId={viewId} onClose={() => setViewId(null)} />}
    </div>
  );
}
