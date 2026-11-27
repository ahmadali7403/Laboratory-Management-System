"use client";

import { useEffect, useRef } from "react";
import { Layers, Minus, Plus, Trash2 } from "lucide-react";
import { formatDate, formatMoney } from "@/lib/client";
import CartPanel from "@/components/pos/CartPanel";

export default function PharmacyCart({
  cart,
  selectedIdx,
  focusQtyToken = 0,
  canUndo = false,
  dark = false,
  onSelectIdx,
  onChangeQty,
  onChangeDiscount,
  onSwitchBatch,
  onRemove,
  onUndo,
  onClear,
  onFocusSearch,
}) {
  const tableRef = useRef(null);

  useEffect(() => {
    if (!focusQtyToken || selectedIdx < 0) return;
    const input = tableRef.current?.querySelector(`input[data-qty-idx="${selectedIdx}"]`);
    if (input) {
      input.focus();
      input.select?.();
    }
  }, [focusQtyToken, selectedIdx]);

  return (
    <CartPanel
      title="Cart Items"
      count={cart.length}
      canUndo={canUndo}
      onUndo={onUndo}
      onClear={onClear}
      dark={dark}
    >
      {cart.length === 0 ? (
        <div className="flex h-full min-h-[120px] flex-col items-center justify-center p-4 text-center text-xs" style={{ color: "var(--pos-muted)" }}>
          <p className="font-semibold" style={{ color: "var(--pos-text)" }}>Cart is empty</p>
          <p className="mt-1">Search a medicine or scan a barcode and press <kbd className="rounded border px-1 font-mono text-[10px]">Enter</kbd></p>
        </div>
      ) : (
        <table ref={tableRef} className="w-full text-left text-[12px]">
          <thead
            className="pos-surface-alt sticky top-0 z-10 border-b text-[10px] font-bold uppercase"
            style={{ color: "var(--pos-muted)" }}
          >
            <tr>
              <th className="w-6 px-2 py-1.5">#</th>
              <th className="px-1.5 py-1.5">Medicine / Batch</th>
              <th className="w-24 px-1 py-1.5 text-center">Qty</th>
              <th className="w-14 px-1 py-1.5 text-right">Disc</th>
              <th className="w-20 px-2 py-1.5 text-right">Total</th>
              <th className="w-7 px-1 py-1.5" />
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--pos-border)" }}>
            {cart.map((item, idx) => {
              const maxStock = Number(item.batch.quantity);
              const gross = item.qty * Number(item.batch.salePrice);
              const lineTotal = Math.max(0, gross - (Number(item.discount) || 0));
              const isSelected = idx === selectedIdx;

              return (
                <tr
                  key={item.batch.id}
                  onClick={() => onSelectIdx(idx)}
                  onKeyDown={(e) => {
                    if (e.key === "Delete") {
                      e.preventDefault();
                      onRemove(idx);
                    } else if (e.key === "ArrowDown" && e.target.tagName !== "INPUT") {
                      e.preventDefault();
                      onSelectIdx(Math.min(cart.length - 1, idx + 1));
                    } else if (e.key === "ArrowUp" && e.target.tagName !== "INPUT") {
                      e.preventDefault();
                      onSelectIdx(Math.max(0, idx - 1));
                    }
                  }}
                  style={{
                    borderColor: "var(--pos-border)",
                    backgroundColor: isSelected ? "var(--pos-row-active)" : undefined,
                  }}
                >
                  <td className="px-2 py-1.5 text-[10.5px]" style={{ color: "var(--pos-muted)" }}>{idx + 1}</td>
                  <td className="px-1.5 py-1.5 align-top">
                    <p className="font-semibold leading-tight">
                      {item.medicine.name}
                      {item.medicine.strength ? <span className="ml-1 font-normal" style={{ color: "var(--pos-muted)" }}>{item.medicine.strength}</span> : ""}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px]" style={{ color: "var(--pos-muted)" }}>
                      <span className="font-mono">{item.batch.batchNumber}</span>
                      <span>· {formatDate(item.batch.expiryDate)}</span>
                      <span>· @{Number(item.batch.salePrice).toFixed(0)}</span>
                      {(item.medicine.validBatches?.length || 0) > 1 && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onSwitchBatch(idx); }}
                          className="inline-flex items-center gap-0.5 rounded bg-blue-500/15 px-1 py-px font-semibold text-blue-500 hover:bg-blue-500/25"
                        >
                          <Layers size={9} /> Batch
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-1 py-1.5 align-top">
                    <div className="flex items-center justify-center gap-0.5">
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => onChangeQty(idx, Math.max(1, item.qty - 1))}
                        aria-label="Decrease quantity"
                        className="pos-surface-alt flex h-6 w-5 items-center justify-center rounded border hover:opacity-80"
                      >
                        <Minus size={10} />
                      </button>
                      <input
                        type="number"
                        min="0.01"
                        max={maxStock}
                        step="any"
                        data-qty-idx={idx}
                        value={item.qty}
                        aria-label={`Quantity for ${item.medicine.name}`}
                        onFocus={() => onSelectIdx(idx)}
                        onChange={(e) => onChangeQty(idx, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            onFocusSearch?.();
                          } else if (e.key === "Delete" && e.ctrlKey) {
                            e.preventDefault();
                            onRemove(idx);
                          }
                        }}
                        className="pos-input h-6 w-11 rounded border px-1 text-center text-xs font-bold tabular-nums outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => onChangeQty(idx, Math.min(maxStock, item.qty + 1))}
                        aria-label="Increase quantity"
                        className="pos-surface-alt flex h-6 w-5 items-center justify-center rounded border hover:opacity-80"
                      >
                        <Plus size={10} />
                      </button>
                    </div>
                  </td>
                  <td className="px-1 py-1.5 text-right align-top">
                    <input
                      type="number"
                      min="0"
                      max={gross}
                      step="any"
                      value={item.discount === 0 ? "" : item.discount}
                      placeholder="0"
                      aria-label={`Discount for ${item.medicine.name}`}
                      onFocus={() => onSelectIdx(idx)}
                      onChange={(e) => onChangeDiscount(idx, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          onFocusSearch?.();
                        }
                      }}
                      className="pos-input h-6 w-12 rounded border px-1 text-right text-xs tabular-nums outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right align-top font-bold tabular-nums">
                    {formatMoney(lineTotal)}
                  </td>
                  <td className="px-1 py-1.5 text-center align-top">
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => onRemove(idx)}
                      aria-label={`Remove ${item.medicine.name}`}
                      title="Remove (Ctrl+Del)"
                      className="rounded p-1 text-rose-500 hover:bg-rose-500/10"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </CartPanel>
  );
}
