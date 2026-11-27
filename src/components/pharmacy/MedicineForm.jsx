"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { Button, Field, FormError, Modal, Select, inputClass, useToast } from "@/components/ui";
import { DOSAGE_FORMS } from "@/lib/pharmacy";

export default function MedicineForm({
  scope,
  medicine = null,
  categories = [],
  companies = [],
  suppliers = [],
  onClose,
  onSaved,
}) {
  const toast = useToast();
  const isNew = !medicine;
  const showBranch = isNew && scope.role !== "BRANCH_ADMIN" && !scope.branchId;
  const [branchId, setBranchId] = useState(scope.branchId || "");

  const [form, setForm] = useState({
    name: medicine?.name || "",
    genericName: medicine?.genericName || "",
    categoryId: medicine?.categoryId || "",
    companyId: medicine?.companyId || "",
    defaultSupplierId: medicine?.defaultSupplierId || "",
    strength: medicine?.strength || "",
    dosageForm: medicine?.dosageForm || "Tablet",
    unit: medicine?.unit || "pcs",
    packSize: String(medicine?.packSize ?? 1),
    barcode: medicine?.barcode || "",
    sku: medicine?.sku || "",
    lowStockAlert: String(medicine?.lowStockAlert ?? 10),
    defaultPurchasePrice: String(medicine?.defaultPurchasePrice ?? 0),
    defaultSalePrice: String(medicine?.defaultSalePrice ?? 0),
    rackLocation: medicine?.rackLocation || "",
    description: medicine?.description || "",
    status: medicine?.status || "ACTIVE",
    priceChangeReason: "",
  });

  const [addInitialBatch, setAddInitialBatch] = useState(false);
  const [batch, setBatch] = useState({
    batchNumber: "",
    expiryDate: "",
    quantity: "",
    purchasePrice: "",
    salePrice: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...(showBranch ? { branchId } : {}),
        name: form.name.trim(),
        genericName: form.genericName.trim() || null,
        categoryId: form.categoryId || null,
        companyId: form.companyId || null,
        defaultSupplierId: form.defaultSupplierId || null,
        strength: form.strength.trim() || null,
        dosageForm: form.dosageForm || null,
        unit: form.unit.trim() || "pcs",
        packSize: Number(form.packSize) || 1,
        barcode: form.barcode.trim() || null,
        sku: form.sku.trim() || null,
        lowStockAlert: Number(form.lowStockAlert) || 0,
        defaultPurchasePrice: Number(form.defaultPurchasePrice) || 0,
        defaultSalePrice: Number(form.defaultSalePrice) || 0,
        rackLocation: form.rackLocation.trim() || null,
        description: form.description.trim() || null,
        status: form.status,
      };
      if (!isNew && form.priceChangeReason.trim()) {
        payload.priceChangeReason = form.priceChangeReason.trim();
      }
      if (isNew && addInitialBatch) {
        payload.initialBatch = {
          batchNumber: batch.batchNumber.trim(),
          expiryDate: batch.expiryDate,
          quantity: Number(batch.quantity) || 0,
          purchasePrice: Number(batch.purchasePrice || form.defaultPurchasePrice) || 0,
          salePrice: Number(batch.salePrice || form.defaultSalePrice) || 0,
          supplierId: form.defaultSupplierId || null,
        };
      }

      await api(isNew ? "/api/pharmacy/medicines" : `/api/pharmacy/medicines/${medicine.id}`, {
        method: isNew ? "POST" : "PATCH",
        body: payload,
      });
      toast.success(isNew ? "Medicine added." : "Medicine updated.");
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
      size="lg"
      title={isNew ? "Add Medicine" : `Edit Medicine · ${medicine.name}`}
      subtitle={isNew ? "Create catalog record and optionally add an opening batch." : "Edit catalog details. Batch stock & prices are managed per batch."}
      onClose={saving ? undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="med-form" loading={saving}>{isNew ? "Save Medicine" : "Update Medicine"}</Button>
        </>
      }
    >
      <form id="med-form" onSubmit={submit} className="space-y-3">
        <FormError message={error} />
        <div className="grid gap-2.5 sm:grid-cols-3">
          {showBranch && (
            <Field label="Branch" required className="sm:col-span-3">
              <Select required value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputClass}>
                <option value="">Select a branch</option>
                {scope.branches.map((b) => (
                  <option key={b.id} value={b.id}>{scope.role === "SUPER_ADMIN" && !scope.organizationId ? `${b.organizationName} — ${b.name}` : b.name}</option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Medicine Name" required className="sm:col-span-2">
            <input required autoFocus value={form.name} maxLength={160} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Augmentin, Panadol" className={inputClass} />
          </Field>
          <Field label="Strength">
            <input value={form.strength} maxLength={60} onChange={(e) => set("strength", e.target.value)} placeholder="e.g. 500mg, 125mg/5ml" className={inputClass} />
          </Field>
          <Field label="Generic Name / Formula" className="sm:col-span-2">
            <input value={form.genericName} maxLength={160} onChange={(e) => set("genericName", e.target.value)} placeholder="e.g. Amoxicillin + Clavulanic Acid" className={inputClass} />
          </Field>
          <Field label="Dosage Form">
            <Select value={form.dosageForm} onChange={(e) => set("dosageForm", e.target.value)} className={inputClass}>
              <option value="">Select form</option>
              {DOSAGE_FORMS.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
          </Field>
          <Field label="Category">
            <Select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={inputClass}>
              <option value="">None</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Company">
            <Select value={form.companyId} onChange={(e) => set("companyId", e.target.value)} className={inputClass}>
              <option value="">None</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Default Supplier">
            <Select value={form.defaultSupplierId} onChange={(e) => set("defaultSupplierId", e.target.value)} className={inputClass}>
              <option value="">None</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Barcode">
            <input value={form.barcode} maxLength={80} onChange={(e) => set("barcode", e.target.value)} placeholder="Scan or type barcode" className={inputClass} />
          </Field>
          <Field label="Unit" required>
            <input required value={form.unit} maxLength={20} onChange={(e) => set("unit", e.target.value)} placeholder="tab, bottle, strip" className={inputClass} />
          </Field>
          <Field label="Low Stock Alert">
            <input type="number" min="0" step="any" value={form.lowStockAlert} onChange={(e) => set("lowStockAlert", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Default Purchase Price (Rs)">
            <input type="number" min="0" step="any" value={form.defaultPurchasePrice} onChange={(e) => set("defaultPurchasePrice", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Default Sale Price (Rs)">
            <input type="number" min="0" step="any" value={form.defaultSalePrice} onChange={(e) => set("defaultSalePrice", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => set("status", e.target.value)} searchable={false} className={inputClass}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="DISCONTINUED">Discontinued</option>
            </Select>
          </Field>
          <Field label="Rack / Shelf">
            <input value={form.rackLocation} maxLength={60} onChange={(e) => set("rackLocation", e.target.value)} placeholder="e.g. Rack A-3" className={inputClass} />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <input value={form.description} maxLength={500} onChange={(e) => set("description", e.target.value)} className={inputClass} />
          </Field>
          {!isNew && (
            <Field label="Price Change Reason (optional)" className="sm:col-span-3">
              <input value={form.priceChangeReason} maxLength={200} onChange={(e) => set("priceChangeReason", e.target.value)} placeholder="Logged in price audit if default prices change" className={inputClass} />
            </Field>
          )}
        </div>

        {isNew && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
              <input type="checkbox" checked={addInitialBatch} onChange={(e) => setAddInitialBatch(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              Add initial batch &amp; opening stock now
            </label>
            {addInitialBatch && (
              <div className="mt-2.5 grid gap-2 sm:grid-cols-5">
                <Field label="Batch #" required><input required={addInitialBatch} value={batch.batchNumber} onChange={(e) => setBatch({ ...batch, batchNumber: e.target.value })} className={inputClass} /></Field>
                <Field label="Expiry Date" required><input required={addInitialBatch} type="date" value={batch.expiryDate} onChange={(e) => setBatch({ ...batch, expiryDate: e.target.value })} className={inputClass} /></Field>
                <Field label="Stock Qty" required><input required={addInitialBatch} type="number" min="0" step="any" value={batch.quantity} onChange={(e) => setBatch({ ...batch, quantity: e.target.value })} className={inputClass} /></Field>
                <Field label="Purchase Price" required><input required={addInitialBatch} type="number" min="0" step="any" value={batch.purchasePrice || form.defaultPurchasePrice} onChange={(e) => setBatch({ ...batch, purchasePrice: e.target.value })} className={inputClass} /></Field>
                <Field label="Sale Price" required><input required={addInitialBatch} type="number" min="0" step="any" value={batch.salePrice || form.defaultSalePrice} onChange={(e) => setBatch({ ...batch, salePrice: e.target.value })} className={inputClass} /></Field>
              </div>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
