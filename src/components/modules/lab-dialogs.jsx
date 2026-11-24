"use client";

import { useEffect, useMemo, useState } from "react";
import { Ban, CreditCard, Plus, Printer, Search, Trash2 } from "lucide-react";
import { api, formatDateTime, formatMoney, toInputDate } from "@/lib/client";
import { Badge, Button, Field, FormError, Modal, Select, Spinner, StatusBadge, inputClass, useConfirm, useDebounced, useToast } from "@/components/ui";

const METHODS = [["CASH", "Cash"], ["CARD", "Card"], ["BANK_TRANSFER", "Bank transfer"], ["ONLINE", "Online"]];

/** Branch chooser shown only when the view spans several branches. */
function useEffectiveBranch(scope) {
  const needsPick = scope.role !== "BRANCH_ADMIN" && !scope.branchId;
  const [picked, setPicked] = useState("");
  return { needsPick, branchId: scope.branchId || picked, setPicked, picked };
}

function BranchPicker({ scope, picked, onChange }) {
  return (
    <Field label="Branch" required className="sm:col-span-2">
      <Select required value={picked} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value="">Select a branch</option>
        {scope.branches.map((b) => <option key={b.id} value={b.id}>{scope.role === "SUPER_ADMIN" && !scope.organizationId ? `${b.organizationName} — ${b.name}` : b.name}</option>)}
      </Select>
    </Field>
  );
}

// ---------------------------------------------------------------------------
export function NewOrderDialog({ scope, onClose, onSaved, initialWalk = false }) {
  const toast = useToast();
  const eb = useEffectiveBranch(scope);
  const [patientQ, setPatientQ] = useState("");
  const dPatientQ = useDebounced(patientQ);
  const [testQ, setTestQ] = useState("");
  const dTestQ = useDebounced(testQ);
  const [patients, setPatients] = useState([]);
  const [tests, setTests] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patientId, setPatientId] = useState("");
  const [walk, setWalk] = useState(Boolean(initialWalk));
  const [wi, setWi] = useState({ name: "", fatherName: "", gender: "MALE", ageYears: "", phone: "" });
  const [referredBy, setReferredBy] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [selected, setSelected] = useState({});
  const [discount, setDiscount] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const b = eb.branchId;

  useEffect(() => {
    if (!b) return;
    api(`/api/doctors?branchId=${b}&active=1&pageSize=100`).then((d) => setDoctors(d.items)).catch(() => {});
  }, [b]);
  useEffect(() => {
    if (!b) return;
    api(`/api/patients?branchId=${b}&pageSize=30&q=${encodeURIComponent(dPatientQ)}`).then((d) => setPatients(d.items)).catch(() => {});
  }, [b, dPatientQ]);
  useEffect(() => {
    if (!b) return;
    api(`/api/tests?branchId=${b}&active=1&pageSize=40&q=${encodeURIComponent(dTestQ)}`).then((d) => setTests(d.items)).catch(() => {});
  }, [b, dTestQ]);

  const doctorList = b ? doctors : [];
  const patientList = b ? patients : [];
  const testList = b ? tests : [];
  const list = Object.values(selected);
  const subtotal = list.reduce((s, t) => s + Number(t.price), 0);
  const disc = Math.min(Number(discount) || 0, subtotal);
  const total = subtotal - disc;

  function toggle(t) {
    setSelected((s) => { const n = { ...s }; if (n[t.id]) delete n[t.id]; else n[t.id] = t; return n; });
  }

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    if (!walk && !patientId) return setError("Please select a patient or switch to walk-in.");
    if (!list.length) return setError("Please select at least one test.");
    setSaving(true); setError("");
    try {
      const patientPart = walk ? { walkIn: { ...wi, ageYears: wi.ageYears === "" ? null : Number(wi.ageYears) } } : { patientId };
      const body = { ...patientPart, referredBy, doctorId: doctorId || null, testIds: list.map((t) => t.id), discount: disc, notes, ...(eb.needsPick ? { branchId: eb.picked } : {}) };
      if (Number(payAmount) > 0) body.payment = { amount: Number(payAmount), method };
      const res = await api("/api/orders", { method: "POST", body });
      toast.success(`Order ${res.orderNo} created.`);
      onSaved();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  return (
    <Modal open size="xl" title="New laboratory order" onClose={saving ? undefined : onClose}
      footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form="order-form" loading={saving}>Create order · {formatMoney(total)}</Button></>}>
      <form id="order-form" onSubmit={submit} className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <FormError message={error} />
          {eb.needsPick && <BranchPicker scope={scope} picked={eb.picked} onChange={(v) => { eb.setPicked(v); setPatientId(""); setSelected({}); setDoctorId(""); }} />}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
            <button type="button" onClick={() => setWalk(false)} className={`rounded-md px-3 py-1.5 ${!walk ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>Registered patient</button>
            <button type="button" onClick={() => setWalk(true)} className={`rounded-md px-3 py-1.5 ${walk ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>Walk-in patient</button>
          </div>
          {walk ? (
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 p-3">
              <Field label="Patient name" required className="col-span-2"><input required={walk} value={wi.name} maxLength={120} onChange={(e) => setWi({ ...wi, name: e.target.value })} className={inputClass} disabled={!b} /></Field>
              <Field label="Father / husband name" className="col-span-2"><input value={wi.fatherName} maxLength={120} onChange={(e) => setWi({ ...wi, fatherName: e.target.value })} className={inputClass} disabled={!b} /></Field>
              <Field label="Age (years)"><input type="number" min="0" max="120" value={wi.ageYears} onChange={(e) => setWi({ ...wi, ageYears: e.target.value })} className={inputClass} disabled={!b} /></Field>
              <Field label="Gender"><Select value={wi.gender} onChange={(e) => setWi({ ...wi, gender: e.target.value })} className={inputClass} disabled={!b}><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></Select></Field>
              <Field label="Phone" className="col-span-2"><input value={wi.phone} maxLength={30} onChange={(e) => setWi({ ...wi, phone: e.target.value })} className={inputClass} disabled={!b} /></Field>
            </div>
          ) : (
            <Field label="Patient" required hint={!b ? "Select a branch first." : "Search by name, MRN or phone."}>
              <input value={patientQ} onChange={(e) => setPatientQ(e.target.value)} placeholder="Search patient..." className={`${inputClass} mb-2`} disabled={!b} />
              <Select required={!walk} value={patientId} onChange={(e) => setPatientId(e.target.value)} className={inputClass} disabled={!b} size={Math.min(5, Math.max(2, patientList.length || 2))}>
                {patientList.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.mrn}{p.phone ? ` · ${p.phone}` : ""}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Referring doctor">
            <Select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className={inputClass} disabled={!b}>
              <option value="">— Self / none —</option>
              {doctorList.map((d) => <option key={d.id} value={d.id}>{d.name}{d.specialization ? ` (${d.specialization})` : ""}</option>)}
            </Select>
          </Field>
          <Field label="Referred by"><input value={referredBy} maxLength={120} onChange={(e) => setReferredBy(e.target.value)} className={inputClass} placeholder="Clinic / person (optional)" /></Field>
          <Field label="Notes"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={2} className={`${inputClass} h-auto py-2`} /></Field>
        </div>

        <div className="space-y-4">
          <Field label="Tests" required hint={`${list.length} selected`}>
            <div className="relative mb-2"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={testQ} onChange={(e) => setTestQ(e.target.value)} placeholder="Search tests..." className={`${inputClass} pl-9`} disabled={!b} /></div>
            <div className="max-h-52 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
              {testList.length === 0 && <p className="p-4 text-center text-xs text-slate-400">{b ? "No tests found." : "Select a branch first."}</p>}
              {testList.map((t) => (
                <label key={t.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={Boolean(selected[t.id])} onChange={() => toggle(t)} className="h-4 w-4 rounded border-slate-300" />
                  <span className="flex-1"><span className="font-medium text-slate-800">{t.name}</span> <span className="text-xs text-slate-400">{t.code} · {t.sampleType}</span></span>
                  <span className="text-xs font-semibold text-slate-600">{formatMoney(t.price)}</span>
                </label>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Discount (Rs)"><input type="number" min="0" step="any" value={discount} onChange={(e) => setDiscount(e.target.value)} className={inputClass} /></Field>
            <Field label="Payment now (Rs)"><input type="number" min="0" max={total} step="any" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className={inputClass} /></Field>
            <Field label="Method" className="col-span-2"><Select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>{METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 text-sm">
            <Row l="Subtotal" v={formatMoney(subtotal)} /><Row l="Discount" v={`- ${formatMoney(disc)}`} />
            <div className="mt-2 border-t border-slate-200 pt-2"><Row l="Total" v={formatMoney(total)} bold /></div>
            <Row l="Balance after payment" v={formatMoney(Math.max(0, total - (Number(payAmount) || 0)))} />
          </div>
        </div>
      </form>
    </Modal>
  );
}
const Row = ({ l, v, bold }) => <div className={`flex justify-between py-0.5 ${bold ? "font-bold text-slate-900" : "text-slate-600"}`}><span>{l}</span><span>{v}</span></div>;

// ---------------------------------------------------------------------------
export function PaymentDialog({ order, onClose, onSaved }) {
  const toast = useToast();
  const balance = Math.round((Number(order.total) - Number(order.paidAmount)) * 100) / 100;
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true); setError("");
    try {
      await api(`/api/orders/${order.id}/payments`, { method: "POST", body: { amount: Number(amount), method, reference } });
      toast.success("Payment recorded.");
      onSaved();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  return (
    <Modal open size="sm" title={`Record payment · ${order.orderNo}`} subtitle={`Outstanding balance ${formatMoney(balance)}`} onClose={saving ? undefined : onClose}
      footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form="pay-form" loading={saving}>Record payment</Button></>}>
      <form id="pay-form" onSubmit={submit} className="space-y-4">
        <FormError message={error} />
        <Field label="Amount (Rs)" required><input type="number" required min="0.01" max={balance} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} /></Field>
        <Field label="Method"><Select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>{METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
        <Field label="Reference"><input value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} className={inputClass} placeholder="Transaction / slip no." /></Field>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
export function OrderDetailDialog({ orderId, onClose, onChanged }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [pay, setPay] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => api(`/api/orders/${orderId}`).then(setOrder).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function cancel() {
    const ok = await confirm({ title: "Cancel order", message: `Cancel order ${order.orderNo}? This cannot be undone.`, confirmLabel: "Cancel order", danger: true });
    if (!ok || busy) return;
    setBusy(true);
    try { await api(`/api/orders/${orderId}`, { method: "PATCH", body: { action: "cancel" } }); toast.success("Order cancelled."); onChanged(); await load(); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }

  const balance = order ? Number(order.total) - Number(order.paidAmount) : 0;
  return (
    <>
      <Modal open size="lg" title={order ? `Order ${order.orderNo}` : "Order"} subtitle={order ? `${order.patient.name} · ${order.patient.mrn} · ${order.branch.name}` : undefined} onClose={onClose}
        footer={order && <>
          {order.status === "COMPLETED" && <a href={`/reports/${order.id}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"><Printer size={15} /> Report</a>}
          {order.status !== "CANCELLED" && <a href={`/billing/${order.id}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"><Printer size={15} /> Invoice</a>}
          {order.status !== "CANCELLED" && balance > 0 && <Button onClick={() => setPay(true)}><CreditCard size={15} /> Record payment</Button>}
          {!["CANCELLED", "COMPLETED"].includes(order.status) && <Button variant="danger" onClick={cancel} loading={busy}><Ban size={15} /> Cancel order</Button>}
        </>}>
        {error ? <p className="text-sm text-rose-600">{error}</p> : !order ? <Spinner /> : (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap gap-2"><StatusBadge value={order.status} /><StatusBadge value={order.paymentStatus} /><span className="text-xs text-slate-400">Created {formatDateTime(order.createdAt)} by {order.createdByName}</span></div>
            <div className="grid gap-2 sm:hidden">{order.items.map((i) => <div key={i.id} className="rounded-xl border border-slate-200 p-3"><p className="break-words font-semibold text-slate-800">{i.testName}</p><div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs"><span className="text-slate-500">Sample <StatusBadge value={i.sample?.status} /></span><span className="text-slate-500">Result <StatusBadge value={i.resultStatus} /></span><b>{formatMoney(i.price)}</b></div></div>)}</div>
            <div className="hidden overflow-hidden rounded-xl border border-slate-200 sm:block"><table className="w-full table-fixed text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase text-slate-500"><tr><th className="px-3 py-2">Test</th><th className="px-3 py-2">Sample</th><th className="px-3 py-2">Result</th><th className="px-3 py-2 text-right">Price</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{order.items.map((i) => <tr key={i.id}><td className="break-words px-3 py-2 font-medium">{i.testName}</td><td className="px-3 py-2"><StatusBadge value={i.sample?.status} /></td><td className="px-3 py-2"><StatusBadge value={i.resultStatus} /></td><td className="px-3 py-2 text-right">{formatMoney(i.price)}</td></tr>)}</tbody></table></div>
            <div className="ml-auto max-w-xs rounded-xl bg-slate-50 p-4">
              <Row l="Subtotal" v={formatMoney(order.subtotal)} /><Row l="Discount" v={`- ${formatMoney(order.discount)}`} />
              <Row l="Total" v={formatMoney(order.total)} bold /><Row l="Paid" v={formatMoney(order.paidAmount)} /><Row l="Balance" v={formatMoney(balance)} bold />
            </div>
            {order.payments.length > 0 && <div><p className="mb-2 text-xs font-semibold uppercase text-slate-500">Payments</p>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">{order.payments.map((p) => <li key={p.id} className="flex justify-between px-3 py-2"><span>{formatDateTime(p.createdAt)} · {p.method.replace("_", " ")}{p.reference ? ` · ${p.reference}` : ""}</span><span className="font-semibold">{formatMoney(p.amount)}</span></li>)}</ul></div>}
          </div>
        )}
      </Modal>
      {pay && order && <PaymentDialog order={order} onClose={() => setPay(false)} onSaved={() => { setPay(false); onChanged(); load(); }} />}
    </>
  );
}

// ---------------------------------------------------------------------------
export function ResultDialog({ item, onClose, onSaved }) {
  const toast = useToast();
  const panel = item.results?.length > 0;
  const [value, setValue] = useState(item.resultValue || "");
  const [unit, setUnit] = useState(item.unit || item.test?.unit || "");
  const [flag, setFlag] = useState(item.flag || "NORMAL");
  const [comments, setComments] = useState(item.comments || "");
  const [rows, setRows] = useState(() => (item.results || []).map((r) => ({ id: r.id, value: r.value || "", flag: r.value ? r.flag : "" })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const range = item.test?.refRangeText || (item.test?.refLow != null || item.test?.refHigh != null ? `${item.test.refLow ?? ""} - ${item.test.refHigh ?? ""}` : "Not defined");
  const rangeOf = (r) => r.refRangeText || (r.refLow != null && r.refHigh != null ? `${r.refLow} - ${r.refHigh}` : r.refLow != null ? `≥ ${r.refLow}` : r.refHigh != null ? `≤ ${r.refHigh}` : "");
  const setRow = (i, k, v) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true); setError("");
    try {
      const body = panel
        ? { action: "enter", comments, values: rows.map((r) => ({ id: r.id, value: r.value, flag: r.flag || null })) }
        : { action: "enter", resultValue: value, unit, flag, comments };
      await api(`/api/results/${item.id}`, { method: "PATCH", body });
      toast.success("Result saved.");
      onSaved();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  return (
    <Modal open size={panel ? "xl" : "md"} title={`Enter result · ${item.testName}`} subtitle={`${item.order.patient.name} · ${item.order.orderNo}`} onClose={saving ? undefined : onClose}
      footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form="result-form" loading={saving}>Save result</Button></>}>
      <form id="result-form" onSubmit={submit} className="space-y-4">
        <FormError message={error} />
        {panel ? (
          <>
            <p className="text-xs text-slate-500">Enter every value. Numeric values are flagged High/Low automatically from the reference range; use the Flag column only to override.</p>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase text-slate-500"><tr><th className="px-3 py-2 text-left">Parameter</th><th className="px-3 py-2 text-left">Reference</th><th className="px-3 py-2 text-left">Unit</th><th className="w-40 px-3 py-2 text-left">Result</th><th className="w-32 px-3 py-2 text-left">Flag</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {item.results.map((r, i) => (
                    <tr key={r.id}>
                      <td className="px-3 py-1.5 font-medium text-slate-800">{r.name}</td>
                      <td className="px-3 py-1.5 text-slate-600">{rangeOf(r) || "—"}</td>
                      <td className="px-3 py-1.5 text-slate-500">{r.unit || ""}</td>
                      <td className="px-3 py-1.5"><input required value={rows[i].value} maxLength={300} onChange={(e) => setRow(i, "value", e.target.value)} className={`${inputClass} h-9`} aria-label={`${r.name} result`} autoFocus={i === 0} /></td>
                      <td className="px-3 py-1.5"><Select value={rows[i].flag} onChange={(e) => setRow(i, "flag", e.target.value)} className={`${inputClass} h-9`} aria-label={`${r.name} flag`}><option value="">Auto</option>{["NORMAL", "LOW", "HIGH", "CRITICAL", "ABNORMAL"].map((f) => <option key={f}>{f}</option>)}</Select></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Field label="Comments"><textarea value={comments} maxLength={500} rows={2} onChange={(e) => setComments(e.target.value)} className={`${inputClass} h-auto py-2`} /></Field>
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 sm:col-span-2">Reference range: <b>{range}</b> {item.test?.unit || ""}</p>
            <Field label="Result" required className="sm:col-span-2"><input required autoFocus value={value} maxLength={500} onChange={(e) => setValue(e.target.value)} className={inputClass} /></Field>
            <Field label="Unit"><input value={unit} maxLength={30} onChange={(e) => setUnit(e.target.value)} className={inputClass} /></Field>
            <Field label="Flag" hint="Numeric results are flagged automatically from the reference range."><Select value={flag} onChange={(e) => setFlag(e.target.value)} className={inputClass}>{["NORMAL", "LOW", "HIGH", "CRITICAL", "ABNORMAL"].map((f) => <option key={f}>{f}</option>)}</Select></Field>
            <Field label="Comments" className="sm:col-span-2"><textarea value={comments} maxLength={500} rows={2} onChange={(e) => setComments(e.target.value)} className={`${inputClass} h-auto py-2`} /></Field>
          </div>
        )}
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
export function NewPurchaseDialog({ scope, onClose, onSaved }) {
  const toast = useToast();
  const eb = useEffectiveBranch(scope);
  const b = eb.branchId;
  const [suppliers, setSuppliers] = useState([]);
  const [stock, setStock] = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [date, setDate] = useState(toInputDate(new Date()));
  const [lines, setLines] = useState([{ inventoryItemId: "", quantity: "", unitCost: "" }]);
  const [receiveNow, setReceiveNow] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!b) return;
    api(`/api/suppliers?branchId=${b}&active=1&pageSize=100`).then((d) => setSuppliers(d.items)).catch(() => {});
    api(`/api/inventory?branchId=${b}&active=1&pageSize=100`).then((d) => setStock(d.items)).catch(() => {});
  }, [b]);

  const supplierList = b ? suppliers : [];
  const stockList = b ? stock : [];
  const total = useMemo(() => lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0), [lines]);
  const setLine = (i, k, v) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true); setError("");
    try {
      const res = await api("/api/purchases", { method: "POST", body: {
        supplierId, purchaseDate: date, notes, receiveNow,
        items: lines.map((l) => ({ inventoryItemId: l.inventoryItemId, quantity: Number(l.quantity), unitCost: Number(l.unitCost) })),
        ...(eb.needsPick ? { branchId: eb.picked } : {}),
      } });
      toast.success(`Purchase ${res.purchaseNo} created.`);
      onSaved();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  return (
    <Modal open size="lg" title="New purchase" onClose={saving ? undefined : onClose}
      footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form="purchase-form" loading={saving}>Save · {formatMoney(total)}</Button></>}>
      <form id="purchase-form" onSubmit={submit} className="space-y-4">
        <FormError message={error} />
        <div className="grid gap-4 sm:grid-cols-2">
          {eb.needsPick && <BranchPicker scope={scope} picked={eb.picked} onChange={(v) => { eb.setPicked(v); setSupplierId(""); setLines([{ inventoryItemId: "", quantity: "", unitCost: "" }]); }} />}
          <Field label="Supplier" required><Select required value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputClass} disabled={!b}><option value="">Select supplier</option>{supplierList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          <Field label="Purchase date" required><input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} /></Field>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-700">Items</p>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_5rem_6rem_2rem] items-center gap-2">
                <Select required value={l.inventoryItemId} onChange={(e) => setLine(i, "inventoryItemId", e.target.value)} className={inputClass} disabled={!b} aria-label="Item"><option value="">Select item</option>{stockList.map((s) => <option key={s.id} value={s.id} disabled={lines.some((x, j) => j !== i && x.inventoryItemId === s.id)}>{s.name} ({s.unit})</option>)}</Select>
                <input required type="number" min="0.01" step="any" placeholder="Qty" value={l.quantity} onChange={(e) => setLine(i, "quantity", e.target.value)} className={inputClass} aria-label="Quantity" />
                <input required type="number" min="0" step="any" placeholder="Unit cost" value={l.unitCost} onChange={(e) => setLine(i, "unitCost", e.target.value)} className={inputClass} aria-label="Unit cost" />
                <Button variant="ghost" size="icon" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label="Remove line"><Trash2 size={15} /></Button>
              </div>
            ))}
          </div>
          <Button variant="secondary" size="sm" className="mt-2" onClick={() => setLines((ls) => [...ls, { inventoryItemId: "", quantity: "", unitCost: "" }])}><Plus size={14} /> Add item</Button>
          {b && stockList.length === 0 && <p className="mt-2 text-xs text-amber-600">This branch has no inventory items yet. Add them in Inventory first.</p>}
        </div>
        <Field label="Notes"><input value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} className={inputClass} /></Field>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={receiveNow} onChange={(e) => setReceiveNow(e.target.checked)} className="h-4 w-4 rounded border-slate-300" /> Mark as received now (adds to stock immediately)</label>
      </form>
    </Modal>
  );
}
export { Badge };
