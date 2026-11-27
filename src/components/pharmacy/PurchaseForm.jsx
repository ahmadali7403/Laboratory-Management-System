"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, formatMoney, toInputDate } from "@/lib/client";
import { PHARMACY_PAYMENT_METHODS } from "@/lib/pharmacy";
import { Button, Field, FormError, Modal, Select, inputClass, useToast } from "@/components/ui";
import MedicineSearch from "@/components/pharmacy/MedicineSearch";
import PurchaseItems from "@/components/pharmacy/PurchaseItems";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export default function PurchaseForm({ scope, onClose, onSaved }) {
  const toast = useToast();
  const needsPick = scope.role !== "BRANCH_ADMIN" && !scope.branchId;
  const [picked, setPicked] = useState("");
  const branchId = scope.branchId || picked;

  const [rawSuppliers, setRawSuppliers] = useState([]);
  const suppliers = branchId ? rawSuppliers : [];
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(toInputDate(new Date()));
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState("");
  const [additionalCharges, setAdditionalCharges] = useState("");
  const [payMode, setPayMode] = useState("PAID"); // "PAID" | "PARTIAL" | "UNPAID"
  const [paidAmount, setPaidAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [finalizeNow, setFinalizeNow] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const searchRef = useRef(null);

  useEffect(() => {
    if (!branchId) return;
    let stop = false;
    api(`/api/pharmacy/suppliers?options=1&branchId=${branchId}`)
      .then((d) => !stop && setRawSuppliers(d.items || []))
      .catch(() => {});
    return () => { stop = true; };
  }, [branchId]);

  const subtotal = useMemo(() => round2(items.reduce((s, i) => s + round2((Number(i.quantity) || 0) * (Number(i.purchasePrice) || 0)), 0)), [items]);
  const discRs = Math.min(subtotal, round2(discount));
  const extraRs = round2(additionalCharges);
  const total = round2(Math.max(0, subtotal - discRs + extraRs));
  const effectivePaid = payMode === "PAID" ? total : payMode === "UNPAID" ? 0 : Math.min(total, round2(paidAmount));

  function addMedicine(med) {
    setItems((prev) => [
      ...prev,
      {
        medicine: med,
        batchNumber: "",
        expiryDate: "",
        quantity: 1,
        purchasePrice: Number(med.defaultPurchasePrice || 0),
        salePrice: Number(med.defaultSalePrice || 0),
      },
    ]);
  }

  function updateItem(idx, key, val) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: val } : it)));
  }

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    if (!branchId) return setError("Select a branch first.");
    if (!supplierId) return setError("Select a supplier.");
    if (items.length === 0) return setError("Add at least one medicine.");
    setSaving(true);
    setError("");
    try {
      const res = await api("/api/pharmacy/purchases", {
        method: "POST",
        body: {
          ...(needsPick ? { branchId } : {}),
          supplierId,
          invoiceNo: invoiceNo.trim() || null,
          purchaseDate,
          discount: discRs,
          additionalCharges: extraRs,
          paidAmount: effectivePaid,
          paymentMethod,
          notes: notes.trim() || null,
          finalizeNow,
          status: "ORDERED",
          items: items.map((i) => ({
            medicineId: i.medicine.id,
            batchNumber: i.batchNumber.trim(),
            expiryDate: i.expiryDate,
            quantity: Number(i.quantity),
            purchasePrice: Number(i.purchasePrice),
            salePrice: Number(i.salePrice),
          })),
        },
      });
      toast.success(res.message);
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
      size="doc"
      title="New Pharmacy Purchase"
      subtitle="Enter batch numbers, expiry dates, and pricing. Stock increases only when finalized."
      onClose={saving ? undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="pharm-purchase-form" loading={saving}>
            {finalizeNow ? `Finalize Purchase · ${formatMoney(total)}` : `Save Order · ${formatMoney(total)}`}
          </Button>
        </>
      }
    >
      <form id="pharm-purchase-form" onSubmit={submit} className="space-y-3">
        <FormError message={error} />
        <div className="grid gap-2.5 sm:grid-cols-4">
          {needsPick && (
            <Field label="Branch" required>
              <Select required value={picked} onChange={(e) => { setPicked(e.target.value); setItems([]); setSupplierId(""); }} className={inputClass}>
                <option value="">Select branch</option>
                {scope.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Supplier" required className={needsPick ? "" : "sm:col-span-2"}>
            <Select required value={supplierId} onChange={(e) => setSupplierId(e.target.value)} disabled={!branchId} className={inputClass}>
              <option value="">Select supplier...</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Purchase Date" required>
            <input required type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Supplier Invoice #">
            <input value={invoiceNo} maxLength={80} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="Optional" className={inputClass} />
          </Field>
        </div>

        <div className="grid gap-3 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="flex h-64 flex-col rounded-lg border border-slate-200 bg-slate-50/40 p-2">
            <p className="mb-1 text-[11px] font-bold uppercase text-slate-500">Add Medicines</p>
            <MedicineSearch branchId={branchId} mode="purchase" inputRef={searchRef} onSelect={addMedicine} />
          </div>
          <div className="min-w-0">
            <PurchaseItems
              items={items}
              onChange={updateItem}
              onRemove={(idx) => setItems((prev) => prev.filter((_, i) => i !== idx))}
            />
          </div>
        </div>

        <div className="grid gap-2.5 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 sm:grid-cols-6">
          <Field label="Discount (Rs)">
            <input type="number" min="0" step="any" value={discount} onChange={(e) => setDiscount(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Extra Charges (Rs)">
            <input type="number" min="0" step="any" value={additionalCharges} onChange={(e) => setAdditionalCharges(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Payment Status">
            <Select value={payMode} onChange={(e) => setPayMode(e.target.value)} searchable={false} className={inputClass}>
              <option value="PAID">Paid</option>
              <option value="PARTIAL">Partial</option>
              <option value="UNPAID">Unpaid (Credit)</option>
            </Select>
          </Field>
          <Field label="Paid Amount (Rs)">
            <input
              type="number"
              min="0"
              max={total}
              step="any"
              disabled={payMode !== "PARTIAL"}
              value={payMode === "PAID" ? String(total) : payMode === "UNPAID" ? "0" : paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Method">
            <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} searchable={false} className={inputClass}>
              {PHARMACY_PAYMENT_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <div className="flex flex-col justify-end text-right text-xs">
            <span className="text-slate-500">Subtotal: {formatMoney(subtotal)}</span>
            <span className="text-sm font-extrabold text-slate-900">Total: {formatMoney(total)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
            <input type="checkbox" checked={finalizeNow} onChange={(e) => setFinalizeNow(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Finalize purchase immediately (adds batches to stock and updates supplier balance)
          </label>
          <input value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className={`${inputClass} sm:w-72`} />
        </div>
      </form>
    </Modal>
  );
}
