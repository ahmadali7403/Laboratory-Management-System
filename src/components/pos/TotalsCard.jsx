"use client";

import { formatMoney } from "@/lib/client";
import { KeyBadge } from "@/components/shortcut-bar";

export default function TotalsCard({
  subtotal = 0,
  itemDiscountTotal = 0,
  discRs = 0,
  total = 0,
  discType,
  discValue,
  onDiscTypeChange,
  onDiscValueChange,
  discountRef,
  payTouched,
  payAmount,
  onPayAmountChange,
  onPayFull,
  onPayZero,
  balance = 0,
  change = 0,
  onEnterComplete,
  ready = true,
  dark = false,
  canDiscount = true,
  maxDiscountPct = 100,
}) {
  return (
    <div className="space-y-1.5">
      <div className="pos-surface-alt rounded-lg border px-2.5 py-1.5 text-[12px]">
        <div className="flex justify-between py-0.5" style={{ color: "var(--pos-muted)" }}>
          <span>Subtotal</span>
          <span className="tabular-nums font-medium" style={{ color: "var(--pos-text)" }}>
            {formatMoney(subtotal)}
          </span>
        </div>
        {itemDiscountTotal > 0 && (
          <div className="flex justify-between py-0.5" style={{ color: "var(--pos-muted)" }}>
            <span>Item Discount</span>
            <span className="tabular-nums font-medium text-amber-500">-{formatMoney(itemDiscountTotal)}</span>
          </div>
        )}
        {discRs > 0 && (
          <div className="flex justify-between py-0.5" style={{ color: "var(--pos-muted)" }}>
            <span>Bill Discount</span>
            <span className="tabular-nums font-medium text-amber-500">-{formatMoney(discRs)}</span>
          </div>
        )}
        <div className="mt-1 flex items-baseline justify-between border-t pt-1" style={{ borderColor: "var(--pos-border)" }}>
          <span className="text-xs font-bold uppercase tracking-wide">Grand Total</span>
          <span className="text-lg font-extrabold tabular-nums tracking-tight text-emerald-500">
            {formatMoney(total)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <span className="mb-0.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--pos-muted)" }}>
            <span>Discount {maxDiscountPct < 100 ? `(≤${maxDiscountPct}%)` : ""}</span>
            <KeyBadge dark={dark}>F6</KeyBadge>
          </span>
          <div className="flex gap-1">
            <input
              ref={discountRef}
              type="number"
              min="0"
              step="any"
              value={discValue}
              disabled={!ready || !canDiscount}
              onChange={(e) => onDiscValueChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onEnterComplete?.();
                }
              }}
              placeholder="0"
              aria-label="Bill discount"
              className="pos-input h-8 min-w-0 flex-1 rounded-md border px-2 text-xs font-semibold tabular-nums outline-none focus:border-blue-500 disabled:opacity-50"
            />
            <select
              value={discType}
              disabled={!ready || !canDiscount}
              onChange={(e) => onDiscTypeChange(e.target.value)}
              aria-label="Discount type"
              className="pos-input h-8 w-12 shrink-0 rounded-md border px-1 text-xs font-semibold outline-none focus:border-blue-500 disabled:opacity-50"
            >
              <option value="RS">Rs</option>
              <option value="PCT">%</option>
            </select>
          </div>
        </div>

        <div>
          <span className="mb-0.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--pos-muted)" }}>
            <span>Paid (Rs)</span>
            <span className="flex gap-1.5 normal-case">
              <button type="button" tabIndex={-1} onClick={onPayFull} className="font-semibold text-blue-500 hover:underline">
                Full
              </button>
              <button type="button" tabIndex={-1} onClick={onPayZero} className="font-semibold hover:underline" style={{ color: "var(--pos-muted)" }}>
                Credit
              </button>
            </span>
          </span>
          <input
            type="number"
            min="0"
            step="any"
            value={payTouched ? payAmount : String(total || "")}
            disabled={!ready}
            onChange={(e) => onPayAmountChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onEnterComplete?.();
              }
            }}
            aria-label="Paid amount"
            className="pos-input h-8 w-full rounded-md border px-2 text-sm font-bold tabular-nums outline-none focus:border-blue-500 disabled:opacity-50"
          />
        </div>
      </div>

      {(balance > 0 || change > 0) && (
        <div className="pos-surface-alt flex items-center justify-between rounded-md border px-2.5 py-1 text-xs font-bold">
          {balance > 0 ? (
            <>
              <span className="text-rose-500">Balance Due</span>
              <span className="tabular-nums text-rose-500">{formatMoney(balance)}</span>
            </>
          ) : (
            <>
              <span className="text-emerald-500">Change Return</span>
              <span className="tabular-nums text-emerald-500">{formatMoney(change)}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
