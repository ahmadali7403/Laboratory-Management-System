"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, Footprints, Printer, UserRound, X } from "lucide-react";
import { api, formatMoney } from "@/lib/client";
import { Select, useDebounced, useToast } from "@/components/ui";
import MedicineSearch from "@/components/pharmacy/MedicineSearch";
import BatchSelector from "@/components/pharmacy/BatchSelector";
import PharmacyCart from "@/components/pharmacy/PharmacyCart";
import PharmacyPayment from "@/components/pharmacy/PharmacyPayment";

const ic = "h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-[13px] text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100";
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export default function PharmacyPOS({ scope }) {
  const toast = useToast();
  const needsPick = scope.role !== "BRANCH_ADMIN" && !scope.branchId;
  const [picked, setPicked] = useState("");
  const branchId = scope.branchId || picked;

  // Walk-in Customer is default; optional registered customer lookup replaces it.
  const [customerMode, setCustomerMode] = useState("walkin"); // "walkin" | "registered"
  const [walkName, setWalkName] = useState("");
  const [walkPhone, setWalkPhone] = useState("");
  const [custQ, setCustQ] = useState("");
  const dCustQ = useDebounced(custQ, 220);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Cart & batches
  const [cart, setCart] = useState([]); // [{ medicine, batch, qty, discount }]
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [batchModal, setBatchModal] = useState(null); // { medicine, cartIdx: number | null }
  const [refreshKey, setRefreshKey] = useState(0);

  // Billing
  const [discType, setDiscType] = useState("RS");
  const [discValue, setDiscValue] = useState("");
  const [payTouched, setPayTouched] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lastSale, setLastSale] = useState(null);

  const searchRef = useRef(null);

  useEffect(() => {
    if (!branchId || customerMode !== "registered") return;
    let stop = false;
    api(`/api/pharmacy/customers?branchId=${branchId}&q=${encodeURIComponent(dCustQ.trim())}`)
      .then((d) => !stop && setCustomers(d.items || []))
      .catch(() => {});
    return () => { stop = true; };
  }, [branchId, dCustQ, customerMode]);

  const customerOptions = useMemo(() => {
    const list = branchId && customerMode === "registered" ? customers : [];
    return selectedCustomer && !list.some((c) => c.id === selectedCustomer.id) ? [selectedCustomer, ...list] : list;
  }, [selectedCustomer, customers, branchId, customerMode]);

  const addOrIncrement = useCallback(
    (medicine, batch) => {
      if (!batch || Number(batch.quantity) <= 0) {
        toast.error("Selected batch has no available stock.");
        return;
      }
      setCart((prev) => {
        const existingIdx = prev.findIndex((x) => x.batch.id === batch.id);
        if (existingIdx >= 0) {
          const cur = prev[existingIdx];
          const max = Number(cur.batch.quantity);
          if (cur.qty + 1 > max) {
            toast.error(`Only ${max} ${medicine.unit} available in batch ${batch.batchNumber}.`);
            return prev;
          }
          setSelectedIdx(existingIdx);
          return prev.map((x, i) => (i === existingIdx ? { ...x, qty: round2(x.qty + 1) } : x));
        }
        setSelectedIdx(prev.length);
        return [...prev, { medicine, batch, qty: 1, discount: 0 }];
      });
      setError("");
    },
    [toast],
  );

  function handleChangeQty(idx, raw) {
    const val = Math.max(0.01, Number(raw) || 0);
    setCart((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const max = Number(item.batch.quantity);
        if (val > max) {
          toast.error(`Maximum available in batch ${item.batch.batchNumber} is ${max}.`);
          return { ...item, qty: max };
        }
        return { ...item, qty: round2(val) };
      }),
    );
  }

  function handleChangeDiscount(idx, raw) {
    setCart((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const maxDisc = round2(item.qty * Number(item.batch.salePrice));
        const val = Math.max(0, Math.min(maxDisc, Number(raw) || 0));
        return { ...item, discount: round2(val) };
      }),
    );
  }

  function handleRemove(idx) {
    setCart((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      setSelectedIdx((s) => Math.max(0, Math.min(s, next.length - 1)));
      return next;
    });
    setTimeout(() => searchRef.current?.focus(), 0);
  }

  function handleBatchChosen(medicine, batch) {
    if (batchModal?.cartIdx != null) {
      const idx = batchModal.cartIdx;
      setCart((prev) => {
        const dup = prev.findIndex((x, i) => i !== idx && x.batch.id === batch.id);
        if (dup >= 0) {
          toast.info(`Batch ${batch.batchNumber} is already in the cart.`);
          return prev;
        }
        return prev.map((item, i) => {
          if (i !== idx) return item;
          const max = Number(batch.quantity);
          return { ...item, batch, qty: Math.min(item.qty, max) };
        });
      });
    } else {
      addOrIncrement(medicine, batch);
    }
    setBatchModal(null);
    setTimeout(() => searchRef.current?.focus(), 0);
  }

  // Money calculations
  const subtotal = round2(cart.reduce((s, item) => s + round2(item.qty * Number(item.batch.salePrice)), 0));
  const itemDiscountTotal = round2(cart.reduce((s, item) => s + round2(item.discount || 0), 0));
  const afterItemDisc = round2(Math.max(0, subtotal - itemDiscountTotal));
  const discRs = Math.min(
    afterItemDisc,
    round2(discType === "PCT" ? (afterItemDisc * Math.min(100, Number(discValue) || 0)) / 100 : Number(discValue) || 0),
  );
  const total = round2(Math.max(0, afterItemDisc - discRs));
  const paid = payTouched ? round2(Math.max(0, Number(payAmount) || 0)) : total;
  const appliedPaid = round2(Math.min(paid, total));
  const balance = round2(Math.max(0, total - appliedPaid));
  const change = round2(Math.max(0, paid - total));

  function printReceipt(id) {
    const f = document.createElement("iframe");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    f.src = `/embed/pharmacy/invoice/${id}`;
    f.onload = () => {
      try {
        f.contentWindow.focus();
        f.contentWindow.print();
      } catch {
        window.open(`/embed/pharmacy/invoice/${id}`, "_blank");
      }
      setTimeout(() => f.remove(), 60_000);
    };
    document.body.appendChild(f);
  }

  function resetSale() {
    setCart([]);
    setSelectedIdx(0);
    setCustomerMode("walkin");
    setWalkName("");
    setWalkPhone("");
    setSelectedCustomer(null);
    setCustQ("");
    setDiscValue("");
    setPayTouched(false);
    setPayAmount("");
    setReference("");
    setNotes("");
    setError("");
    setTimeout(() => searchRef.current?.focus(), 40);
  }

  async function completeSale(shouldPrint) {
    if (saving) return;
    if (needsPick && !picked) {
      setError("Please select a branch.");
      toast.error("Please select a branch.");
      return;
    }
    if (cart.length === 0) {
      setError("Add at least one medicine to complete the sale.");
      toast.error("Cart is empty.");
      searchRef.current?.focus();
      return;
    }
    if (customerMode === "registered" && !selectedCustomer) {
      setError("Select a registered customer or switch to Walk-in Customer.");
      toast.error("Select a customer or switch to Walk-in.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const body = {
        ...(needsPick ? { branchId: picked } : {}),
        ...(customerMode === "registered" && selectedCustomer
          ? { patientId: selectedCustomer.id }
          : {
              customerName: walkName.trim() || "Walk-in Customer",
              customerPhone: walkPhone.trim() || null,
            }),
        discount: discRs,
        paidAmount: paid,
        paymentMethod: method,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
        items: cart.map((item) => ({
          batchId: item.batch.id,
          quantity: item.qty,
          discount: round2(item.discount || 0),
        })),
      };

      const res = await api("/api/pharmacy/sales", { method: "POST", body });
      toast.success(`Sale ${res.saleNo} completed.`);
      setLastSale({
        id: res.id,
        saleNo: res.saleNo,
        total: res.total,
        paidAmount: res.paidAmount,
        changeAmount: res.changeAmount,
      });
      setRefreshKey((k) => k + 1);
      if (shouldPrint) printReceipt(res.id);
      resetSale();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const completeRef = useRef(completeSale);
  const removeRef = useRef(handleRemove);
  useEffect(() => {
    completeRef.current = completeSale;
    removeRef.current = handleRemove;
  });

  useEffect(() => {
    function onKey(e) {
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (e.key === "F8" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        completeRef.current(false);
      } else if (e.key === "F9") {
        e.preventDefault();
        completeRef.current(true);
      } else if (e.key === "Escape") {
        if (batchModal) {
          e.preventDefault();
          setBatchModal(null);
          searchRef.current?.focus();
        }
      } else if (e.key === "Delete" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName || "")) {
        if (cart.length > 0 && selectedIdx >= 0 && selectedIdx < cart.length) {
          e.preventDefault();
          removeRef.current(selectedIdx);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [batchModal, cart.length, selectedIdx]);

  const ready = Boolean(branchId);

  return (
    <div className="flex flex-col gap-1.5 lg:h-[calc(100vh-4.35rem)]">
      {lastSale && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-900">
          <Check size={14} className="text-emerald-600" />
          <b>{lastSale.saleNo}</b> saved · Total {formatMoney(lastSale.total)} · Paid {formatMoney(lastSale.paidAmount)}
          {lastSale.changeAmount > 0 && <span className="font-semibold text-emerald-700">· Change {formatMoney(lastSale.changeAmount)}</span>}
          <button
            type="button"
            onClick={() => printReceipt(lastSale.id)}
            className="ml-1 inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 font-semibold text-emerald-700 ring-1 ring-emerald-300 hover:bg-emerald-100"
          >
            <Printer size={12} /> Print Invoice
          </button>
          <button type="button" onClick={() => setLastSale(null)} aria-label="Dismiss" className="ml-auto text-emerald-700 hover:text-emerald-950">
            <X size={14} />
          </button>
        </div>
      )}

      {needsPick && (
        <div className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5">
          <label className="flex max-w-sm items-center gap-2 text-xs font-semibold text-amber-900">
            <span>Branch:</span>
            <select
              className={ic}
              value={picked}
              onChange={(e) => {
                setPicked(e.target.value);
                resetSale();
              }}
            >
              <option value="">Select a branch...</option>
              {scope.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {scope.role === "SUPER_ADMIN" && !scope.organizationId ? `${b.organizationName} — ${b.name}` : b.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-1.5 lg:grid-cols-[minmax(0,1fr)_310px]">
        {/* Left & Middle: Customer bar + Medicine Search + Cart */}
        <div className="flex min-h-0 min-w-0 flex-col gap-1.5">
          {/* Customer Bar (Walk-in by default) */}
          <section className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => { setCustomerMode("walkin"); setSelectedCustomer(null); }}
                    className={`flex items-center gap-1 rounded px-2 py-0.5 ${customerMode === "walkin" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500"}`}
                  >
                    <Footprints size={12} /> Walk-in (Default)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerMode("registered")}
                    className={`flex items-center gap-1 rounded px-2 py-0.5 ${customerMode === "registered" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
                  >
                    <UserRound size={12} /> Registered
                  </button>
                </div>

                {customerMode === "walkin" ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <input
                      className="h-7 w-44 rounded border border-slate-200 px-2 text-xs outline-none focus:border-blue-500"
                      value={walkName}
                      disabled={!ready}
                      placeholder="Walk-in Customer (optional)"
                      onChange={(e) => setWalkName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchRef.current?.focus(); } }}
                    />
                    <input
                      className="h-7 w-32 rounded border border-slate-200 px-2 text-xs outline-none focus:border-blue-500"
                      value={walkPhone}
                      disabled={!ready}
                      placeholder="Phone (optional)"
                      onChange={(e) => setWalkPhone(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchRef.current?.focus(); } }}
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-64">
                      <Select
                        value={selectedCustomer?.id || ""}
                        onChange={(e) => setSelectedCustomer(customerOptions.find((c) => c.id === e.target.value) || null)}
                        onSearch={setCustQ}
                        disabled={!ready}
                        className="!h-7 !text-xs"
                      >
                        <option value="">Search registered customer...</option>
                        {customerOptions.map((c) => (
                          <option key={c.id} value={c.id}>{c.name} · {c.mrn}{c.phone ? ` · ${c.phone}` : ""}</option>
                        ))}
                      </Select>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setCustomerMode("walkin"); setSelectedCustomer(null); }}
                      className="text-[11px] font-semibold text-blue-600 hover:underline"
                    >
                      Use Walk-in
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 text-[11px]">
                <Link href="/pharmacy/sales" className="font-semibold text-slate-600 hover:text-blue-600">Sales History</Link>
                <Link href="/pharmacy" className="font-semibold text-slate-600 hover:text-blue-600">Dashboard</Link>
              </div>
            </div>
          </section>

          {/* Main Product Search + Cart split */}
          <div className="grid min-h-0 flex-1 gap-1.5 md:grid-cols-2">
            <section className="flex min-h-[260px] min-w-0 flex-col rounded-lg border border-slate-200 bg-white p-2">
              <div className="mb-1 flex shrink-0 items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wide text-slate-600">Medicine &amp; Barcode Search</h2>
                <span className="text-[10px] font-semibold text-emerald-700">FEFO Auto-Batch</span>
              </div>
              <MedicineSearch
                branchId={branchId}
                mode="pos"
                inputRef={searchRef}
                refreshKey={refreshKey}
                onSelect={addOrIncrement}
                onPickBatch={(med) => setBatchModal({ medicine: med, cartIdx: null })}
              />
              <p className="mt-1 shrink-0 truncate text-[10px] text-slate-400">
                <kbd className="rounded bg-slate-100 px-1 font-mono text-slate-600">↑/↓</kbd> Select ·{" "}
                <kbd className="rounded bg-slate-100 px-1 font-mono text-slate-600">Enter</kbd> Add ·{" "}
                <kbd className="rounded bg-slate-100 px-1 font-mono text-slate-600">F2</kbd> Focus Search ·{" "}
                <kbd className="rounded bg-slate-100 px-1 font-mono text-slate-600">Del</kbd> Remove ·{" "}
                <kbd className="rounded bg-slate-100 px-1 font-mono text-slate-600">Ctrl+↵</kbd> Complete
              </p>
            </section>

            <PharmacyCart
              cart={cart}
              selectedIdx={selectedIdx}
              onSelectIdx={setSelectedIdx}
              onChangeQty={handleChangeQty}
              onChangeDiscount={handleChangeDiscount}
              onSwitchBatch={(idx) => setBatchModal({ medicine: cart[idx].medicine, cartIdx: idx })}
              onRemove={handleRemove}
              onClear={resetSale}
              onFocusSearch={() => searchRef.current?.focus()}
            />
          </div>
        </div>

        {/* Right: Payment Area */}
        <aside className="min-h-0">
          <PharmacyPayment
            subtotal={subtotal}
            itemDiscountTotal={itemDiscountTotal}
            discType={discType}
            discValue={discValue}
            onDiscTypeChange={setDiscType}
            onDiscValueChange={setDiscValue}
            discRs={discRs}
            total={total}
            payTouched={payTouched}
            payAmount={payAmount}
            onPayAmountChange={(v) => { setPayTouched(true); setPayAmount(v); }}
            onPayFull={() => { setPayTouched(false); setPayAmount(""); }}
            onPayZero={() => { setPayTouched(true); setPayAmount("0"); }}
            paid={paid}
            balance={balance}
            change={change}
            method={method}
            onMethodChange={setMethod}
            reference={reference}
            onReferenceChange={setReference}
            notes={notes}
            onNotesChange={setNotes}
            error={error}
            saving={saving}
            ready={ready}
            onComplete={completeSale}
            onReset={resetSale}
          />
        </aside>
      </div>

      {batchModal && (
        <BatchSelector
          medicine={batchModal.medicine}
          selectedBatchId={batchModal.cartIdx != null ? cart[batchModal.cartIdx]?.batch?.id : null}
          onSelect={handleBatchChosen}
          onClose={() => { setBatchModal(null); searchRef.current?.focus(); }}
        />
      )}
    </div>
  );
}
