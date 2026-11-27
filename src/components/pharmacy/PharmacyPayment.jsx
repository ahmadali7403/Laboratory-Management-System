"use client";

import { Printer, RotateCcw } from "lucide-react";
import { formatMoney } from "@/lib/client";
import { PHARMACY_PAYMENT_METHODS } from "@/lib/pharmacy";

const ic = "h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-[13px] text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100";

const Row = ({ l, v, big, danger, good }) => (
  <div className={`flex justify-between py-0.5 ${big ? "text-base font-extrabold text-slate-900" : danger ? "font-bold text-rose-600" : good ? "font-bold text-emerald-700" : "text-slate-600"}`}>
    <span>{l}</span>
    <span className="tabular-nums">{v}</span>
  </div>
);

export default function PharmacyPayment({
  subtotal,
  itemDiscountTotal,
  discType,
  discValue,
  onDiscTypeChange,
  onDiscValueChange,
  discRs,
  total,
  payTouched,
  payAmount,
  onPayAmountChange,
  onPayFull,
  onPayZero,
  paid,
  balance,
  change,
  method,
  onMethodChange,
  reference,
  onReferenceChange,
  notes,
  onNotesChange,
  error,
  saving,
  ready,
  discountRef,
  onComplete,
  onReset,
}) {
  return (
    <section className="flex h-full flex-col justify-between space-y-2 rounded-lg border border-slate-200 bg-white p-2.5">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-600">Billing &amp; Payment</h2>
          <span className="text-[10px] font-semibold text-slate-400">F9 Print · F10 Save</span>
        </div>

        <div className="rounded-md bg-slate-50 px-2.5 py-1.5 text-[12.5px]">
          <Row l="Subtotal" v={formatMoney(subtotal)} />
          {itemDiscountTotal > 0 && <Row l="Item Discounts" v={`- ${formatMoney(itemDiscountTotal)}`} />}
          {discRs > 0 && <Row l="Bill Discount" v={`- ${formatMoney(discRs)}`} />}
          <div className="mt-1 border-t border-slate-200 pt-1">
            <Row l="Grand Total" v={formatMoney(total)} big />
          </div>
        </div>

        <div className="grid grid-cols-[1fr_72px] gap-2">
          <label className="block">
            <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Bill Discount (F6)</span>
            <input
              ref={discountRef}
              className={ic}
              type="number"
              min="0"
              step="any"
              value={discValue}
              disabled={!ready}
              onChange={(e) => onDiscValueChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onComplete?.(true); } }}
              placeholder="0"
            />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Type</span>
            <select className={ic} value={discType} disabled={!ready} onChange={(e) => onDiscTypeChange(e.target.value)}>
              <option value="RS">Rs</option>
              <option value="PCT">%</option>
            </select>
          </label>
        </div>

        <div>
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Payment Method</span>
          <div className="grid grid-cols-3 gap-1">
            {PHARMACY_PAYMENT_METHODS.map(([v, label]) => (
              <button
                key={v}
                type="button"
                disabled={!ready}
                onClick={() => onMethodChange(v)}
                className={`rounded border px-1.5 py-1 text-[11px] font-semibold transition ${
                  method === v
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-1.5">
          <label className="block">
            <span className="mb-0.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <span>Paid Amount (Rs)</span>
              <span className="flex gap-1.5 normal-case">
                <button type="button" onClick={onPayFull} className="font-semibold text-blue-600 hover:underline">Full</button>
                <button type="button" onClick={onPayZero} className="font-semibold text-slate-500 hover:underline">Credit/Later</button>
              </span>
            </span>
            <input
              className={`${ic} text-sm font-bold`}
              type="number"
              min="0"
              step="any"
              disabled={!ready}
              value={payTouched ? payAmount : String(total || "")}
              onChange={(e) => onPayAmountChange(e.target.value)}
            />
          </label>
          {method !== "CASH" && (
            <label className="block">
              <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Reference / Trx ID</span>
              <input
                className={ic}
                value={reference}
                maxLength={100}
                disabled={!ready}
                placeholder="Receipt / TID / Account"
                onChange={(e) => onReferenceChange(e.target.value)}
              />
            </label>
          )}
        </div>

        <div className="rounded-md bg-slate-50 px-2.5 py-1.5 text-[12.5px]">
          <Row l="Remaining Balance" v={formatMoney(balance)} danger={balance > 0} />
          <Row l="Change to Return" v={formatMoney(change)} good={change > 0} />
        </div>

        <label className="block">
          <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Notes</span>
          <input
            className={ic}
            value={notes}
            maxLength={400}
            disabled={!ready}
            placeholder="Optional prescription / remarks"
            onChange={(e) => onNotesChange(e.target.value)}
          />
        </label>
      </div>

      <div className="space-y-1.5 pt-1">
        {error && <p className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700">{error}</p>}

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            disabled={saving || !ready}
            onClick={() => onComplete(false)}
            className="h-9 rounded-md bg-blue-600 px-2 text-[12.5px] font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Only (F10)"}
          </button>
          <button
            type="button"
            disabled={saving || !ready}
            onClick={() => onComplete(true)}
            className="flex h-9 items-center justify-center gap-1 rounded-md bg-emerald-600 px-2 text-[12.5px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Printer size={14} /> Save &amp; Print (F9)
          </button>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={onReset}
          className="flex w-full items-center justify-center gap-1 rounded-md border border-slate-200 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <RotateCcw size={12} /> New Sale / Clear
        </button>
      </div>
    </section>
  );
}
