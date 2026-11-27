"use client";

import { Layers, Minus, Plus, Trash2 } from "lucide-react";
import { formatDate, formatMoney } from "@/lib/client";

export default function PharmacyCart({
  cart,
  selectedIdx,
  onSelectIdx,
  onChangeQty,
  onChangeDiscount,
  onSwitchBatch,
  onRemove,
  onClear,
  onFocusSearch,
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-slate-200 bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-2.5 py-1.5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-600">
          Cart ({cart.length} {cart.length === 1 ? "item" : "items"})
        </h2>
        {cart.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] font-semibold text-rose-600 hover:underline"
          >
            Clear cart
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {cart.length === 0 ? (
          <div className="flex h-full min-h-[160px] flex-col items-center justify-center p-4 text-center text-xs text-slate-400">
            <p className="font-semibold text-slate-500">Cart is empty</p>
            <p className="mt-1">Search a medicine or scan a barcode and press <kbd className="rounded bg-slate-100 px-1 font-mono text-slate-600">Enter</kbd></p>
          </div>
        ) : (
          <table className="w-full text-left text-[12.5px]">
            <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] font-bold uppercase text-slate-500 shadow-[0_1px_0_#e2e8f0]">
              <tr>
                <th className="w-6 px-2 py-1.5">#</th>
                <th className="px-2 py-1.5">Medicine / Batch</th>
                <th className="w-24 px-1.5 py-1.5 text-center">Qty</th>
                <th className="w-16 px-1.5 py-1.5 text-right">Rate</th>
                <th className="w-16 px-1.5 py-1.5 text-right">Disc</th>
                <th className="w-20 px-2 py-1.5 text-right">Total</th>
                <th className="w-7 px-1 py-1.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
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
                    className={isSelected ? "bg-blue-50/70" : "hover:bg-slate-50/70"}
                  >
                    <td className="px-2 py-1.5 text-[11px] text-slate-400">{idx + 1}</td>
                    <td className="px-2 py-1.5 align-top">
                      <p className="font-semibold text-slate-900 leading-tight">
                        {item.medicine.name}
                        {item.medicine.strength ? <span className="ml-1 font-normal text-slate-500">{item.medicine.strength}</span> : ""}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-slate-500">
                        <span className="font-mono">{item.batch.batchNumber}</span>
                        <span>· Exp {formatDate(item.batch.expiryDate)}</span>
                        <span>· Max {maxStock}</span>
                        {(item.medicine.validBatches?.length || 0) > 1 && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onSwitchBatch(idx); }}
                            className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1 py-px font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            <Layers size={10} /> Switch
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-1.5 py-1.5 align-top">
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => onChangeQty(idx, Math.max(1, item.qty - 1))}
                          aria-label="Decrease quantity"
                          className="flex h-6 w-5 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-100"
                        >
                          <Minus size={11} />
                        </button>
                        <input
                          type="number"
                          min="0.01"
                          max={maxStock}
                          step="any"
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
                          className="h-6 w-12 rounded border border-slate-300 bg-white px-1 text-center text-xs font-semibold tabular-nums outline-none focus:border-blue-500"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => onChangeQty(idx, Math.min(maxStock, item.qty + 1))}
                          aria-label="Increase quantity"
                          className="flex h-6 w-5 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-100"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </td>
                    <td className="px-1.5 py-1.5 text-right align-top tabular-nums text-slate-600">
                      {Number(item.batch.salePrice).toFixed(2)}
                    </td>
                    <td className="px-1.5 py-1.5 text-right align-top">
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
                        className="h-6 w-14 rounded border border-slate-200 bg-white px-1 text-right text-xs tabular-nums outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right align-top font-bold tabular-nums text-slate-900">
                      {formatMoney(lineTotal)}
                    </td>
                    <td className="px-1 py-1.5 text-center align-top">
                      <button
                        type="button"
                        onClick={() => onRemove(idx)}
                        aria-label={`Remove ${item.medicine.name}`}
                        title="Remove (Del)"
                        className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
