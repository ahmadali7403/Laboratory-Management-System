"use client";

import { Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/client";
import { Button } from "@/components/ui";

const cellInput = "h-7 w-full rounded border border-slate-300 bg-white px-1.5 text-xs outline-none focus:border-blue-500";

export default function PurchaseItems({ items, onChange, onRemove }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center text-xs text-slate-400">
        Search medicines on the left and press <kbd className="rounded bg-white px-1 font-mono text-slate-600 ring-1 ring-slate-200">Enter</kbd> to add purchase lines.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
          <tr>
            <th className="px-2 py-1.5">Medicine</th>
            <th className="w-24 px-1.5 py-1.5">Batch # *</th>
            <th className="w-32 px-1.5 py-1.5">Expiry *</th>
            <th className="w-20 px-1.5 py-1.5 text-right">Qty *</th>
            <th className="w-24 px-1.5 py-1.5 text-right">Cost (Rs) *</th>
            <th className="w-24 px-1.5 py-1.5 text-right">Sale (Rs) *</th>
            <th className="w-24 px-2 py-1.5 text-right">Subtotal</th>
            <th className="w-8 px-1 py-1.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item, idx) => {
            const lineTotal = (Number(item.quantity) || 0) * (Number(item.purchasePrice) || 0);
            return (
              <tr key={`${item.medicine.id}-${idx}`}>
                <td className="px-2 py-1.5 font-medium text-slate-800">
                  {item.medicine.name}
                  {item.medicine.strength ? <span className="ml-1 text-[11px] text-slate-400">{item.medicine.strength}</span> : ""}
                </td>
                <td className="px-1.5 py-1.5">
                  <input required value={item.batchNumber} placeholder="Batch" onChange={(e) => onChange(idx, "batchNumber", e.target.value)} className={`${cellInput} font-mono`} />
                </td>
                <td className="px-1.5 py-1.5">
                  <input required type="date" value={item.expiryDate} onChange={(e) => onChange(idx, "expiryDate", e.target.value)} className={cellInput} />
                </td>
                <td className="px-1.5 py-1.5">
                  <input required type="number" min="0.01" step="any" value={item.quantity} onChange={(e) => onChange(idx, "quantity", e.target.value)} className={`${cellInput} text-right`} />
                </td>
                <td className="px-1.5 py-1.5">
                  <input required type="number" min="0" step="any" value={item.purchasePrice} onChange={(e) => onChange(idx, "purchasePrice", e.target.value)} className={`${cellInput} text-right`} />
                </td>
                <td className="px-1.5 py-1.5">
                  <input required type="number" min="0" step="any" value={item.salePrice} onChange={(e) => onChange(idx, "salePrice", e.target.value)} className={`${cellInput} text-right`} />
                </td>
                <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{formatMoney(lineTotal)}</td>
                <td className="px-1 py-1.5 text-center">
                  <Button variant="ghost" size="icon" onClick={() => onRemove(idx)} aria-label="Remove item">
                    <Trash2 size={13} className="text-rose-500" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
