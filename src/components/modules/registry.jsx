"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Check, Eye, FileText, FlaskConical, PackageCheck, Plus, Printer, ReceiptText, RotateCcw, ShieldCheck, TestTube2, X, XCircle, Droplet } from "lucide-react";
import DataModule from "@/components/data-module";
import { Badge, Button, Field, Modal, StatusBadge, inputClass, useConfirm, useToast } from "@/components/ui";
import { api, formatDate, formatDateTime, formatMoney } from "@/lib/client";
import { NewOrderDialog, NewPurchaseDialog, OrderDetailDialog, PaymentDialog, ResultDialog } from "./lab-dialogs";

const opts = (arr) => arr.map((v) => (Array.isArray(v) ? { value: v[0], label: v[1] } : { value: v, label: v }));
// View opens a compact modal (no page navigation).
const eye = (mod) => ({ label: "View", icon: Eye, onClick: (r, ctx) => ctx.openView(mod, r.id) });
const branchCell = (r) => r.branch?.name || <Badge tone="violet">All branches</Badge>;
const orgWideEdit = (row, scope) => scope.role !== "BRANCH_ADMIN" || row.branchId !== null;
const age = (dob) => (dob ? `${Math.max(0, Math.floor((Date.now() - new Date(dob)) / 3.156e10))}y` : "—");

const CONFIGS = {
  patients: () => ({
    title: "Patients", singular: "Patient", plural: "patients", endpoint: "/api/patients", rowActions: [eye("patients")], searchPlaceholder: "Search by name, MRN, phone or CNIC...",
    columns: [
      { label: "MRN", render: (r) => <span className="font-mono text-xs font-semibold text-slate-600">{r.mrn}</span> },
      { label: "Patient", render: (r) => <div><p className="font-semibold text-slate-800">{r.name}{r.isWalkIn && <Badge tone="violet" className="ml-2">Walk-in</Badge>}</p><p className="text-xs text-slate-400">{r.gender} · {age(r.dateOfBirth)}</p></div> },
      { label: "Phone", key: "phone" }, { label: "CNIC", key: "cnic" },
      { label: "Branch", render: branchCell },
      { label: "Registered", render: (r) => formatDate(r.createdAt) },
    ],
    form: { branch: "required", fields: [
      { name: "name", label: "Full name", required: true, mask: "name", maxLength: 120 },
      { name: "fatherName", label: "Father / husband name", mask: "name", maxLength: 120 },
      { name: "gender", label: "Gender", type: "select", required: true, default: "MALE", options: opts([["MALE", "Male"], ["FEMALE", "Female"], ["OTHER", "Other"]]) },
      { name: "dateOfBirth", label: "Date of birth", type: "date" },
      { name: "phone", label: "Phone", mask: "phone", maxLength: 16, placeholder: "03XXXXXXXXX" }, { name: "cnic", label: "CNIC", mask: "cnic", maxLength: 15, placeholder: "35202-1234567-1" },
      { name: "email", label: "Email", type: "email", span: 2 },
      { name: "address", label: "Address", span: 4, maxLength: 300 },
    ] },
  }),
  doctors: () => ({
    title: "Doctors", singular: "Doctor", plural: "doctors", endpoint: "/api/doctors", rowActions: [eye("doctors")], canEditRow: orgWideEdit,
    columns: [
      { label: "Name", render: (r) => <span className="font-semibold text-slate-800">{r.name}</span> },
      { label: "Specialization", key: "specialization" }, { label: "Phone", key: "phone" },
      { label: "Available to", render: branchCell }, { label: "Status", render: (r) => <StatusBadge value={r.isActive ? "ACTIVE" : "INACTIVE"} /> },
    ],
    form: { branch: "optional", fields: [
      { name: "name", label: "Doctor name", required: true, mask: "name", span: 2 }, { name: "specialization", label: "Specialization" },
      { name: "phone", label: "Phone", mask: "phone", maxLength: 16 }, { name: "email", label: "Email", type: "email", span: 2 },
      { name: "isActive", label: "Status", type: "checkbox", default: true, checkboxLabel: "Active" },
    ] },
  }),
  tests: () => ({
    title: "Test Catalog", singular: "Test", plural: "tests", endpoint: "/api/tests", rowActions: [eye("tests")], canEditRow: orgWideEdit, searchPlaceholder: "Search by name, code or category...",
    columns: [
      { label: "Code", render: (r) => <span className="font-mono text-xs font-semibold">{r.code}</span> },
      { label: "Test", render: (r) => <div><p className="font-semibold text-slate-800">{r.name}</p><p className="text-xs text-slate-400">{r.category || "—"}</p></div> },
      { label: "Sample", key: "sampleType" }, { label: "Price", render: (r) => formatMoney(r.price) },
      { label: "Parameters", render: (r) => (r.parameters?.length ? <Badge tone="blue">{r.parameters.length} parameters</Badge> : <span className="text-xs text-slate-500">{r.refRangeText || (r.refLow != null || r.refHigh != null ? `${r.refLow ?? "…"} - ${r.refHigh ?? "…"} ${r.unit || ""}` : "Single value")}</span>) },
      { label: "Available to", render: branchCell }, { label: "Status", render: (r) => <StatusBadge value={r.isActive ? "ACTIVE" : "INACTIVE"} /> },
    ],
    headerActions: (ctx) => ctx.scope.role === "BRANCH_ADMIN" ? null : <Button variant="secondary" onClick={async () => { try { const r = await api("/api/tests/seed-defaults", { method: "POST", body: {} }); ctx.toast.success(r.message); ctx.refresh(); } catch (e) { ctx.toast.error(e.message); } }}><FlaskConical size={15} /> Add common tests</Button>,
    form: {
      branch: "optional",
      toPayload: (v) => ({
        ...v,
        parameters: (v.parameters || []).map((p) => ({ name: p.name, unit: p.unit || null, refLow: p.refLow === "" ? null : p.refLow, refHigh: p.refHigh === "" ? null : p.refHigh, refRangeText: p.refRangeText || null })),
      }),
      fields: [
      { name: "code", label: "Test code", required: true, maxLength: 30 }, { name: "name", label: "Test name", required: true },
      { name: "category", label: "Category", placeholder: "Hematology, Biochemistry..." }, { name: "sampleType", label: "Sample type", required: true, default: "Blood" },
      { name: "price", label: "Price (Rs)", type: "number", required: true, min: 0 },
      { name: "unit", label: "Result unit", placeholder: "mg/dL", show: (v) => !v.parameters.length },
      { name: "refLow", label: "Reference low", type: "number", show: (v) => !v.parameters.length }, { name: "refHigh", label: "Reference high", type: "number", show: (v) => !v.parameters.length },
      { name: "refRangeText", label: "Reference text", hint: "Optional, for non-numeric ranges", span: 2, show: (v) => !v.parameters.length },
      { name: "parameters", label: "Parameters (for panels like CBC, LFT)", type: "params", default: [], init: (row) => (row.parameters || []).map((p) => ({ name: p.name, unit: p.unit ?? "", refLow: p.refLow ?? "", refHigh: p.refHigh ?? "", refRangeText: p.refRangeText ?? "" })) },
      { name: "turnaroundHours", label: "Turnaround (hours)", type: "number", min: 1 },
      { name: "isActive", label: "Status", type: "checkbox", default: true, checkboxLabel: "Active" },
    ] },
  }),
  suppliers: () => ({
    title: "Suppliers", singular: "Supplier", plural: "suppliers", endpoint: "/api/suppliers", rowActions: [eye("suppliers")], canEditRow: orgWideEdit,
    columns: [
      { label: "Supplier", render: (r) => <span className="font-semibold text-slate-800">{r.name}</span> }, { label: "Contact", key: "contactPerson" },
      { label: "Phone", key: "phone" }, { label: "Available to", render: branchCell }, { label: "Status", render: (r) => <StatusBadge value={r.isActive ? "ACTIVE" : "INACTIVE"} /> },
    ],
    form: { branch: "optional", fields: [
      { name: "name", label: "Supplier name", required: true }, { name: "contactPerson", label: "Contact person" },
      { name: "phone", label: "Phone", mask: "phone", maxLength: 16 }, { name: "email", label: "Email", type: "email", span: 2 }, { name: "address", label: "Address", span: 3, maxLength: 300 },
      { name: "isActive", label: "Status", type: "checkbox", default: true, checkboxLabel: "Active" },
    ] },
  }),
  inventory: () => ({
    title: "Inventory", singular: "Inventory item", plural: "inventory items", endpoint: "/api/inventory", rowActions: [eye("inventory")],
    columns: [
      { label: "Item", render: (r) => <div><p className="font-semibold text-slate-800">{r.name}</p><p className="text-xs text-slate-400">{r.sku || ""}</p></div> },
      { label: "In stock", render: (r) => { const low = Number(r.reorderLevel) > 0 && Number(r.quantity) <= Number(r.reorderLevel); return <span className={low ? "font-bold text-rose-600" : ""}>{Number(r.quantity)} {r.unit}{low && <Badge tone="red" className="ml-2">Low</Badge>}</span>; } },
      { label: "Reorder at", render: (r) => `${Number(r.reorderLevel)} ${r.unit}` }, { label: "Unit cost", render: (r) => (r.unitCost == null ? "—" : formatMoney(r.unitCost)) },
      { label: "Branch", render: branchCell }, { label: "Status", render: (r) => <StatusBadge value={r.isActive ? "ACTIVE" : "INACTIVE"} /> },
    ],
    form: { branch: "required", fields: [
      { name: "name", label: "Item name", required: true }, { name: "sku", label: "SKU / code" },
      { name: "unit", label: "Unit", required: true, default: "pcs" }, { name: "quantity", label: "Quantity in stock", type: "number", default: 0, min: 0 },
      { name: "reorderLevel", label: "Reorder level", type: "number", default: 0, min: 0 }, { name: "unitCost", label: "Unit cost (Rs)", type: "number", min: 0 },
      { name: "isActive", label: "Status", type: "checkbox", default: true, checkboxLabel: "Active" },
    ] },
  }),
  expenses: () => ({
    title: "Expenses", singular: "Expense", plural: "expenses", endpoint: "/api/expenses", rowActions: [eye("expenses")], searchPlaceholder: "Search category or description...",
    columns: [
      { label: "Date", render: (r) => formatDate(r.expenseDate) }, { label: "Category", render: (r) => <span className="font-semibold text-slate-800">{r.category}</span> },
      { label: "Description", key: "description" }, { label: "Method", render: (r) => String(r.paymentMethod || "CASH").replace("_", " ") },
      { label: "Amount", className: "text-right", render: (r) => <b className="tabular-nums">{formatMoney(r.amount)}</b> },
      { label: "Branch", render: branchCell }, { label: "Added by", key: "createdByName" },
    ],
    filters: [{ key: "paymentMethod", label: "All methods", options: opts([["CASH", "Cash"], ["CARD", "Card"], ["BANK_TRANSFER", "Bank transfer"], ["ONLINE", "Online"], ["CHEQUE", "Cheque"]]) }],
    dateRange: true,
    footer: (d) => d && <p className="mt-2 text-right text-xs font-semibold text-slate-700">Total expenses (all filtered entries): {formatMoney(d.totalAmount || 0)}</p>,
    form: { branch: "required", fields: [
      { name: "category", label: "Category", required: true, placeholder: "Rent, Utilities, Salaries...", maxLength: 80 },
      { name: "amount", label: "Amount (Rs)", type: "number", required: true, min: 0.01, step: "0.01" },
      { name: "expenseDate", label: "Date", type: "date", required: true, default: new Date().toISOString().slice(0, 10) },
      { name: "paymentMethod", label: "Payment method", type: "select", required: true, default: "CASH", options: opts([["CASH", "Cash"], ["CARD", "Card"], ["BANK_TRANSFER", "Bank transfer"], ["ONLINE", "Online"], ["CHEQUE", "Cheque"]]) },
      { name: "description", label: "Description", span: 4, maxLength: 300 },
    ] },
  }),
};

// ---- Orders / samples / results / reports / billing / purchases -------------
function OrdersView({ scope, mode }) {
  const [detailId, setDetailId] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [walkFirst, setWalkFirst] = useState(false);
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const n = sp.get("new");
    if (mode === "orders" && (n === "1" || n === "walkin")) {
      setWalkFirst(n === "walkin");
      setNewOpen(true);
      router.replace(pathname, { scroll: false });
    }
  }, [sp]); // eslint-disable-line react-hooks/exhaustive-deps
  const [payOrder, setPayOrder] = useState(null);
  const [bump, setBump] = useState(0);

  const base = {
    endpoint: "/api/orders", singular: "Order", plural: "orders", searchPlaceholder: "Search order no, patient, MRN or phone...",
    columns: [
      { label: "Order", render: (r) => <span className="font-mono text-xs font-semibold text-blue-700">{r.orderNo}</span> },
      { label: "Patient", render: (r) => <div><p className="font-semibold text-slate-800">{r.patient.name}</p><p className="text-xs text-slate-400">{r.patient.mrn}</p></div> },
      { label: "Branch", render: (r) => r.branch.name },
      { label: "Tests", render: (r) => r._count.items },
      { label: "Total", render: (r) => formatMoney(r.total) },
      { label: "Status", render: (r) => <StatusBadge value={r.status} /> },
      { label: "Created", render: (r) => formatDateTime(r.createdAt) },
    ],
  };
  const config = useMemo(() => {
    if (mode === "reports") return {
      ...base, title: "Laboratory Reports", baseParams: { status: "COMPLETED" },
      columns: [...base.columns.slice(0, 3), { label: "Completed", render: (r) => formatDateTime(r.completedAt) }],
      rowActions: [
        eye("orders"),
        { label: "Open report", icon: FileText, variant: "primary", onClick: (r, ctx) => ctx.openDoc("report", r.id) },
      ],
    };
    if (mode === "pay") return {
      ...base, title: "Pay Bill", baseParams: { paymentStatus: "OPEN" },
      columns: [...base.columns.slice(0, 3), { label: "Total", render: (r) => formatMoney(r.total) }, { label: "Paid", render: (r) => formatMoney(r.paidAmount) },
        { label: "Balance", render: (r) => <b className="text-rose-600">{formatMoney(Number(r.total) - Number(r.paidAmount))}</b> }, { label: "Payment", render: (r) => <StatusBadge value={r.paymentStatus} /> }],
      filters: [{ key: "paymentStatus", label: "Unpaid + partial", options: opts([["UNPAID", "Unpaid"], ["PARTIAL", "Partial"]]) }],
      rowActions: [
        eye("orders"),
        { label: "Pay", icon: ReceiptText, variant: "primary", show: (r) => r.status !== "CANCELLED" && Number(r.total) > Number(r.paidAmount), onClick: (r) => setPayOrder(r) },
      ],
    };
    if (mode === "invoices") return {
      ...base, title: "Billing & Payments",
      columns: [...base.columns.slice(0, 3), { label: "Total", render: (r) => formatMoney(r.total) }, { label: "Paid", render: (r) => formatMoney(r.paidAmount) },
        { label: "Balance", render: (r) => <b className={Number(r.total) > Number(r.paidAmount) ? "text-rose-600" : ""}>{formatMoney(Number(r.total) - Number(r.paidAmount))}</b> }, { label: "Payment", render: (r) => <StatusBadge value={r.paymentStatus} /> }],
      filters: [{ key: "paymentStatus", label: "All payments", options: opts([["UNPAID", "Unpaid"], ["PARTIAL", "Partial"], ["PAID", "Paid"]]) }],
      rowActions: [
        eye("orders"),
        { label: "Pay", icon: ReceiptText, variant: "primary", show: (r) => r.status !== "CANCELLED" && Number(r.total) > Number(r.paidAmount), onClick: (r) => setPayOrder(r) },
        { label: "Invoice", icon: Printer, show: (r) => r.status !== "CANCELLED", onClick: (r, ctx) => ctx.openDoc("invoice", r.id) },
      ],
    };
    return {
      ...base, title: "Laboratory Orders", createLabel: "New order",
      filters: [{ key: "status", label: "All statuses", options: opts(["REGISTERED", "SAMPLE_COLLECTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map((s) => [s, s.replace(/_/g, " ")])) },
        { key: "paymentStatus", label: "All payments", options: opts([["UNPAID", "Unpaid"], ["PARTIAL", "Partial"], ["PAID", "Paid"]]) }],
      rowActions: [eye("orders")],
      headerActions: () => <Button onClick={() => setNewOpen(true)}><Plus size={16} /> New order</Button>,
    };
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <DataModule key={`${mode}-${bump}`} config={config} scope={scope} />
      {newOpen && <NewOrderDialog initialWalk={walkFirst} scope={scope} onClose={() => setNewOpen(false)} onSaved={() => { setNewOpen(false); setBump((b) => b + 1); }} />}
      {detailId && <OrderDetailDialog orderId={detailId} onClose={() => setDetailId(null)} onChanged={() => setBump((b) => b + 1)} />}
      {payOrder && <PaymentDialog order={payOrder} onClose={() => setPayOrder(null)} onSaved={() => { setPayOrder(null); setBump((b) => b + 1); }} />}
    </>
  );
}

function PaymentsView({ scope }) {
  const config = {
    title: "Payments", singular: "Payment", plural: "payments", endpoint: "/api/billing", searchPlaceholder: "Search order, patient or reference...",
    filters: [{ key: "method", label: "All methods", options: opts([["CASH", "Cash"], ["CARD", "Card"], ["BANK_TRANSFER", "Bank transfer"], ["ONLINE", "Online"]]) }],
    columns: [
      { label: "Date", render: (r) => formatDateTime(r.createdAt) }, { label: "Order", render: (r) => <span className="font-mono text-xs font-semibold">{r.order.orderNo}</span> },
      { label: "Patient", render: (r) => r.order.patient.name }, { label: "Branch", render: (r) => r.branch.name },
      { label: "Method", render: (r) => r.method.replace("_", " ") }, { label: "Reference", key: "reference" },
      { label: "Received by", key: "receivedByName" }, { label: "Amount", render: (r) => <b>{formatMoney(r.amount)}</b> },
    ],
    footer: (d) => d && <p className="mt-3 text-right text-sm font-semibold text-slate-700">Total received (filtered): {formatMoney(d.totalAmount)}</p>,
  };
  return <DataModule config={config} scope={scope} />;
}

function BillingView({ scope, variant }) {
  const [tab, setTab] = useState("invoices");
  if (variant === "pay") return <OrdersView scope={scope} mode="pay" />;
  return (
    <div>
      <div className="mb-4 inline-flex rounded-xl border border-slate-200 bg-white p-1 text-sm font-semibold">
        {[["invoices", "Invoices"], ["payments", "Payments"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-lg px-4 py-1.5 ${tab === k ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>{l}</button>
        ))}
      </div>
      {tab === "invoices" ? <OrdersView scope={scope} mode="invoices" /> : <PaymentsView scope={scope} />}
    </div>
  );
}

const SAMPLE_VARIANTS = {
  collect: { title: "Collect Sample", status: "PENDING", actions: ["collect"] },
  receive: { title: "Receive Sample", status: "COLLECTED", actions: ["receive"] },
  reject: { title: "Reject Sample", status: null, actions: ["reject", "reset"], notStatus: true },
  list: { title: "Sample List", status: null, actions: ["collect", "receive", "reject", "reset"] },
};

function SamplesView({ scope, variant }) {
  const V = SAMPLE_VARIANTS[variant] || SAMPLE_VARIANTS.list;
  const toast = useToast();
  const confirm = useConfirm();
  const [reason, setReason] = useState(null);
  async function act(row, ctx, action, extra = {}) {
    try { await api(`/api/samples/${row.id}`, { method: "PATCH", body: { action, ...extra } }); ctx.toast.success("Sample updated."); ctx.refresh(); }
    catch (e) { toast.error(e.message); }
  }
  const config = {
    title: V.title, singular: "Sample", plural: "samples", endpoint: "/api/samples", searchPlaceholder: "Search patient name, MRN, phone, order or sample no...",
    baseParams: V.status ? { status: V.status } : undefined,
    filters: V.status ? [] : [{ key: "status", label: "All statuses", options: opts(["PENDING", "COLLECTED", "RECEIVED", "REJECTED"]) }],
    columns: [
      { label: "Sample", render: (r) => <span className="font-mono text-xs font-semibold text-blue-700">{r.sampleNo}</span> },
      { label: "Type", key: "sampleType" }, { label: "Patient", render: (r) => <div><p className="font-semibold text-slate-800">{r.order.patient.name}</p><p className="text-xs text-slate-400">{r.order.patient.mrn}</p></div> },
      { label: "Tests", render: (r) => <span className="text-xs text-slate-500">{r.items.map((i) => i.testName).join(", ")}</span> },
      { label: "Branch", render: (r) => r.order.branch.name }, { label: "Status", render: (r) => <div><StatusBadge value={r.status} />{r.rejectionReason && <p className="mt-1 text-[11px] text-rose-500">{r.rejectionReason}</p>}</div> },
      { label: "Collected", render: (r) => (r.collectedAt ? `${formatDateTime(r.collectedAt)}` : "—") },
    ],
    rowActions: [
      eye("samples"),
      { label: "Collect", icon: Droplet, variant: "primary", show: (r) => r.status === "PENDING", onClick: (r, c) => act(r, c, "collect") },
      { label: "Receive", icon: Check, variant: "success", show: (r) => r.status === "COLLECTED", onClick: (r, c) => act(r, c, "receive") },
      { label: "Reject", icon: XCircle, variant: "secondary", show: (r) => ["PENDING", "COLLECTED", "RECEIVED"].includes(r.status), onClick: (r, c) => setReason({ row: r, ctx: c }) },
      { label: "Re-collect", icon: RotateCcw, show: (r) => r.status === "REJECTED", onClick: async (r, c) => { if (await confirm({ title: "Re-collect sample", message: "Reset this rejected sample so it can be collected again?", confirmLabel: "Reset" })) act(r, c, "reset"); } },
    ],
  };
  const keep = { Collect: "collect", Receive: "receive", Reject: "reject", "Re-collect": "reset" };
  config.rowActions = config.rowActions.filter((a) => a.label === "View" || V.actions.includes(keep[a.label]));
  return (
    <>
      <DataModule key={variant || "list"} config={config} scope={scope} />
      {reason && <RejectDialog onClose={() => setReason(null)} onSubmit={async (text) => { await act(reason.row, reason.ctx, "reject", { reason: text }); setReason(null); }} />}
    </>
  );
}

function RejectDialog({ onClose, onSubmit }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal open size="sm" title="Reject sample" onClose={busy ? undefined : onClose}
      footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" form="reject-form" variant="danger" loading={busy}>Reject sample</Button></>}>
      <form id="reject-form" onSubmit={async (e) => { e.preventDefault(); if (busy) return; setBusy(true); await onSubmit(text); setBusy(false); }}>
        <Field label="Reason" required><textarea required value={text} maxLength={300} onChange={(e) => setText(e.target.value)} rows={3} className={`${inputClass} h-auto py-2`} placeholder="Hemolyzed, insufficient volume, wrong container..." /></Field>
      </form>
    </Modal>
  );
}

const RESULT_VARIANTS = {
  enter: { title: "Enter Result", status: "PENDING", actions: ["Enter"] },
  edit: { title: "Edit Result", status: "ENTERED", actions: ["Edit"] },
  verify: { title: "Verify Result", status: "ENTERED", actions: ["Verify", "Edit"] },
  reopen: { title: "Reopen Result", status: "VERIFIED", actions: ["Re-open"] },
  list: { title: "Result List", status: null, actions: ["Enter", "Edit", "Verify", "Re-open"] },
};

function ResultsView({ scope, variant }) {
  const V = RESULT_VARIANTS[variant] || RESULT_VARIANTS.list;
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [bump, setBump] = useState(0);
  async function act(row, ctx, action) {
    try { await api(`/api/results/${row.id}`, { method: "PATCH", body: { action } }); toast.success(action === "verify" ? "Result verified." : "Result re-opened."); ctx.refresh(); }
    catch (e) { toast.error(e.message); }
  }
  const config = {
    title: V.title, singular: "Result", plural: "results", endpoint: "/api/results", searchPlaceholder: "Search patient name, MRN, test or order...",
    baseParams: V.status ? { status: V.status } : undefined,
    filters: V.status ? [] : [{ key: "status", label: "All results", options: opts([["PENDING", "Awaiting entry"], ["ENTERED", "Awaiting verification"], ["VERIFIED", "Verified"]]) }],
    columns: [
      { label: "Order", render: (r) => <span className="font-mono text-xs font-semibold text-blue-700">{r.order.orderNo}</span> },
      { label: "Patient", render: (r) => <div><p className="font-semibold text-slate-800">{r.order.patient.name}</p><p className="text-xs text-slate-400">{r.order.branch.name}</p></div> },
      { label: "Test", key: "testName" },
      { label: "Result", render: (r) => (r.results?.length ? <span className="text-xs text-slate-600">{r.results.filter((x) => x.value).length}/{r.results.length} entered{r.results.some((x) => x.flag !== "NORMAL" && x.value) && <Badge tone="amber" className="ml-1">abnormal</Badge>}</span> : r.resultValue ? <span>{r.resultValue} <span className="text-xs text-slate-400">{r.unit}</span> {r.flag !== "NORMAL" && <StatusBadge value={r.flag} />}</span> : "—") },
      { label: "Reference", render: (r) => (r.results?.length ? "Panel" : r.refRange || r.test?.refRangeText || (r.test?.refLow != null || r.test?.refHigh != null ? `${r.test.refLow ?? "…"} - ${r.test.refHigh ?? "…"}` : "—")) },
      { label: "Status", render: (r) => <StatusBadge value={r.resultStatus} /> },
    ],
    rowActions: [
      eye("results"),
      { label: "Enter", icon: FlaskConical, variant: "primary", show: (r) => r.resultStatus === "PENDING", onClick: (r) => setEditing(r) },
      { label: "Edit", icon: TestTube2, show: (r) => r.resultStatus === "ENTERED", onClick: (r) => setEditing(r) },
      { label: "Verify", icon: ShieldCheck, variant: "success", show: (r) => r.resultStatus === "ENTERED", onClick: (r, c) => act(r, c, "verify") },
      { label: "Re-open", icon: RotateCcw, show: (r) => r.resultStatus === "VERIFIED", onClick: (r, c) => act(r, c, "reopen") },
    ],
  };
  config.rowActions = config.rowActions.filter((a) => a.label === "View" || V.actions.includes(a.label));
  return (
    <>
      <DataModule key={`${variant || "list"}-${bump}`} config={config} scope={scope} />
      {editing && <ResultDialog item={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setBump((b) => b + 1); }} />}
    </>
  );
}

function PurchasesView({ scope }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [bump, setBump] = useState(0);
  async function act(row, ctx, action) {
    const ok = await confirm({ title: action === "receive" ? "Receive stock" : "Cancel purchase", message: action === "receive" ? `Mark ${row.purchaseNo} as received and add its items to inventory?` : `Cancel purchase ${row.purchaseNo}?`, confirmLabel: action === "receive" ? "Receive" : "Cancel purchase", danger: action === "cancel" });
    if (!ok) return;
    try { const r = await api(`/api/purchases/${row.id}`, { method: "PATCH", body: { action } }); toast.success(r.message); ctx.refresh(); } catch (e) { toast.error(e.message); }
  }
  const config = {
    title: "Purchases", singular: "Purchase", plural: "purchases", endpoint: "/api/purchases", searchPlaceholder: "Search purchase no or supplier...",
    filters: [{ key: "status", label: "All statuses", options: opts(["ORDERED", "RECEIVED", "CANCELLED"]) }],
    columns: [
      { label: "Purchase", render: (r) => <span className="font-mono text-xs font-semibold text-blue-700">{r.purchaseNo}</span> },
      { label: "Supplier", render: (r) => r.supplier.name }, { label: "Branch", render: (r) => r.branch.name }, { label: "Date", render: (r) => formatDate(r.purchaseDate) },
      { label: "Items", render: (r) => <span className="text-xs text-slate-500">{r.items.map((i) => `${i.inventoryItem.name} ×${Number(i.quantity)}`).join(", ")}</span> },
      { label: "Total", render: (r) => formatMoney(r.total) }, { label: "Status", render: (r) => <StatusBadge value={r.status} /> },
    ],
    rowActions: [
      eye("purchases"),
      { label: "Receive", icon: PackageCheck, variant: "success", show: (r) => r.status === "ORDERED", onClick: (r, c) => act(r, c, "receive") },
      { label: "Cancel", icon: X, show: (r) => r.status === "ORDERED", onClick: (r, c) => act(r, c, "cancel") },
    ],
    headerActions: () => <Button onClick={() => setOpen(true)}><Plus size={16} /> New purchase</Button>,
  };
  return (
    <>
      <DataModule key={bump} config={config} scope={scope} />
      {open && <NewPurchaseDialog scope={scope} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); setBump((b) => b + 1); }} />}
    </>
  );
}

function StaffView({ scope }) {
  const [roles, setRoles] = useState(null);
  useEffect(() => { api("/api/roles?options=1").then((d) => setRoles(d.items || [])).catch(() => setRoles([])); }, [scope.organizationId]);
  if (roles === null) return null;
  const needsOrg = !scope.organizationId;
  const config = {
    title: "Staff Management", singular: "Staff member", plural: "staff", endpoint: "/api/staff", rowActions: [eye("staff")], searchPlaceholder: "Search by name, email or phone...",
    banner: () => needsOrg
      ? <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Select an organization in the top bar to add staff members.</p>
      : roles.length === 0 ? <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">No staff roles exist yet. {scope.role === "BRANCH_ADMIN" ? "Ask your organization admin to create roles." : "Create roles under Roles & Permissions first."}</p> : null,
    canCreate: () => !needsOrg && roles.length > 0,
    columns: [
      { label: "Name", render: (r) => <span className="font-semibold text-slate-800">{r.name}</span> }, { label: "Role", render: (r) => (r.role ? <Badge tone="blue">{r.role.name}</Badge> : "—") },
      { label: "Branch", render: (r) => r.branch?.name || "—" }, { label: "Email", key: "email" }, { label: "Phone", key: "phone" },
      { label: "Status", render: (r) => <StatusBadge value={r.status} /> },
    ],
    form: {
      branch: "required",
      toPayload: (v) => { const p = { ...v }; if (!p.email) delete p.email; return p; },
      fields: [
        { name: "name", label: "Full name", required: true, mask: "name", span: 2 },
        { name: "roleId", label: "Role", type: "select", required: true, options: roles.map((r) => ({ value: r.id, label: r.branchName ? `${r.name} · ${r.branchName}` : `${r.name} · all branches` })), init: (row) => row.role?.id || "" },
        { name: "email", label: "Email", type: "email", span: 2 }, { name: "phone", label: "Phone", mask: "phone", maxLength: 16 },
        { name: "status", label: "Status", type: "select", required: true, default: "ACTIVE", options: opts([["ACTIVE", "Active"], ["INACTIVE", "Inactive"]]), editOnly: true },
      ],
    },
  };
  return <DataModule key={`${scope.organizationId}-${roles.length}`} config={config} scope={scope} />;
}


// ---- Inventory: list / stock alert / stock report ---------------------------
const stockOf = (r) => (Number(r.quantity) <= 0 ? "OUT" : Number(r.reorderLevel) > 0 && Number(r.quantity) <= Number(r.reorderLevel) ? "LOW" : "NORMAL");
const StockBadge = ({ r }) => { const k = stockOf(r); return k === "OUT" ? <Badge tone="red">Out of stock</Badge> : k === "LOW" ? <Badge tone="amber">Low stock</Badge> : <Badge tone="green">Normal</Badge>; };
const supplierOf = (r) => r.purchaseItems?.[0]?.purchase?.supplier;

function InventoryView({ scope, variant }) {
  const [suppliers, setSuppliers] = useState([]);
  useEffect(() => { api("/api/suppliers?pageSize=100&active=1").then((d) => setSuppliers(d.items || [])).catch(() => {}); }, [scope.organizationId, scope.branchId]);
  const base = CONFIGS.inventory();
  const stockFilter = { key: "stock", label: "All stock", options: opts([["OUT", "Out of stock"], ["LOW", "Low stock"], ["NORMAL", "Normal"]]) };
  const supplierFilter = { key: "supplierId", label: "All suppliers", options: suppliers.map((x) => ({ value: x.id, label: x.name })) };
  const supplierCol = { label: "Last supplier", render: (r) => supplierOf(r)?.name || "—" };
  const statusCol = { label: "Stock status", render: (r) => <StockBadge r={r} /> };
  const config = { ...base, dateRange: true, searchPlaceholder: "Search item name or code..." };
  if (variant === "alerts") {
    Object.assign(config, {
      title: "Stock Alert", baseParams: { stock: "ALERT" }, canEditRow: undefined,
      filters: [{ key: "stock", label: "Low + out of stock", options: opts([["OUT", "Out of stock"], ["LOW", "Low stock"]]) }, supplierFilter],
      columns: [
        { label: "Item", render: (r) => <span className="font-semibold text-slate-800">{r.name}</span> }, { label: "Code", key: "sku" },
        { label: "Available", render: (r) => <b className={stockOf(r) === "OUT" ? "text-rose-600" : "text-amber-600"}>{Number(r.quantity)} {r.unit}</b> },
        { label: "Minimum level", render: (r) => `${Number(r.reorderLevel)} ${r.unit}` },
        { label: "Restock needed", render: (r) => `${Math.max(0, Number(r.reorderLevel) - Number(r.quantity))} ${r.unit}` },
        supplierCol, statusCol, { label: "Branch", render: branchCell },
      ],
      footer: (d) => d?.summary && <p className="mt-2 text-right text-xs text-slate-600">Out of stock: <b>{d.summary.out}</b> · Low stock: <b>{d.summary.low}</b> (all active items in view)</p>,
    });
  } else if (variant === "report") {
    Object.assign(config, {
      title: "Stock Report", filters: [stockFilter, supplierFilter],
      columns: [
        { label: "Item", render: (r) => <span className="font-semibold text-slate-800">{r.name}</span> }, { label: "Code", key: "sku" },
        { label: "In stock", render: (r) => `${Number(r.quantity)} ${r.unit}` }, { label: "Unit cost", render: (r) => (r.unitCost == null ? "—" : formatMoney(r.unitCost)) },
        { label: "Stock value", className: "text-right", render: (r) => (r.unitCost == null ? "—" : formatMoney(Number(r.quantity) * Number(r.unitCost))) },
        supplierCol, statusCol, { label: "Branch", render: branchCell },
      ],
      headerActions: () => <Button variant="secondary" onClick={() => window.print()}><Printer size={15} /> Print</Button>,
      footer: (d) => d?.summary && <p className="mt-2 text-right text-xs text-slate-700">Active items: <b>{d.summary.items}</b> · Out: <b>{d.summary.out}</b> · Low: <b>{d.summary.low}</b> · Inventory value (items with a unit cost): <b>{formatMoney(d.summary.value)}</b>{d.summary.noCost > 0 && <> · <span className="text-amber-700">{d.summary.noCost} item(s) have no unit cost and are excluded</span></>}</p>,
    });
  } else {
    Object.assign(config, { filters: [stockFilter, supplierFilter], columns: [...base.columns.slice(0, 1), base.columns[1], { label: "Code", key: "sku" }, supplierCol, statusCol, base.columns[4]] });
  }
  return <DataModule key={variant || "list"} config={config} scope={scope} />;
}

export default function ModuleView({ name, scope, variant }) {
  const config = useMemo(() => (CONFIGS[name] ? CONFIGS[name]() : null), [name]);
  if (name === "orders") return <OrdersView scope={scope} mode="orders" />;
  if (name === "reports") return <OrdersView scope={scope} mode="reports" />;
  if (name === "billing") return <BillingView scope={scope} variant={variant} />;
  if (name === "samples") return <SamplesView scope={scope} variant={variant} />;
  if (name === "results") return <ResultsView scope={scope} variant={variant} />;
  if (name === "inventory") return <InventoryView scope={scope} variant={variant} />;
  if (name === "purchases") return <PurchasesView scope={scope} />;
  if (name === "staff") return <StaffView scope={scope} />;
  return config ? <DataModule config={config} scope={scope} /> : null;
}
