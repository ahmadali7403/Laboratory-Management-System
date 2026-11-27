"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Layers } from "lucide-react";
import { formatDate, formatMoney } from "@/lib/client";
import { Badge, Button, Modal } from "@/components/ui";

export default function BatchSelector({ medicine, selectedBatchId, onSelect, onClose }) {
  const batches = medicine?.validBatches || [];
  const [hi, setHi] = useState(() => Math.max(0, batches.findIndex((b) => b.id === selectedBatchId)));
  const boxRef = useRef(null);

  useEffect(() => {
    setTimeout(() => boxRef.current?.focus(), 0);
  }, []);

  function handleKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((i) => Math.min(Math.max(0, batches.length - 1), i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (batches[hi]) onSelect(medicine, batches[hi]);
    }
  }

  return (
    <Modal
      open
      size="md"
      title={`Select batch · ${medicine?.name || ""}`}
      subtitle="Batches are ordered by FEFO (First Expiry, First Out). Expired batches cannot be sold."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel (Esc)</Button>
          <Button disabled={!batches[hi]} onClick={() => batches[hi] && onSelect(medicine, batches[hi])}>
            Select Batch (Enter)
          </Button>
        </>
      }
    >
      <div
        ref={boxRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="overflow-hidden rounded-lg border border-slate-200 outline-none"
      >
        {batches.length === 0 ? (
          <p className="p-4 text-center text-xs text-rose-600">No valid non-expired batches with available stock.</p>
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Batch #</th>
                <th className="px-3 py-2">Expiry</th>
                <th className="px-3 py-2 text-right">Stock</th>
                <th className="px-3 py-2 text-right">Sale Price</th>
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batches.map((b, idx) => {
                const active = idx === hi;
                const current = b.id === selectedBatchId;
                return (
                  <tr
                    key={b.id}
                    onMouseEnter={() => setHi(idx)}
                    onClick={() => onSelect(medicine, b)}
                    className={`cursor-pointer ${active ? "bg-blue-100 ring-2 ring-inset ring-blue-500" : "hover:bg-blue-50"}`}
                  >
                    <td className="px-3 py-2 font-mono text-xs font-semibold text-slate-800">
                      <span className="inline-flex items-center gap-1.5">
                        <Layers size={12} className="text-slate-400" />
                        {b.batchNumber}
                        {idx === 0 && <Badge tone="green">FEFO</Badge>}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700">{formatDate(b.expiryDate)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-emerald-700">
                      {Number(b.quantity)} {medicine.unit}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatMoney(b.salePrice)}</td>
                    <td className="px-2 py-2 text-center">{current && <Check size={14} className="inline text-blue-600" />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  );
}
