"use client";

import { Clock, Play, Trash2 } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { formatDateTime, formatMoney } from "@/lib/client";

export default function HeldBillsModal({
  open,
  bills = [],
  onClose,
  onResume,
  onDelete,
  onHoldCurrent,
  canHoldCurrent = false,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={`Held Bills (${bills.length})`}
      subtitle="Press Enter or click Resume to restore a held bill. Use Hold Current to park the active cart."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close (Esc)</Button>
          {canHoldCurrent && (
            <Button onClick={onHoldCurrent}>Hold Current Bill (F5)</Button>
          )}
        </>
      }
    >
      {bills.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">
          No held bills right now. Press <kbd className="rounded border border-slate-200 bg-slate-100 px-1 font-mono">F5</kbd> with items in the cart to hold a bill.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {bills.map((b, i) => (
            <li key={b.id} className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-slate-50">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {b.label || "Walk-in Customer"}
                </p>
                <p className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1"><Clock size={11} /> {formatDateTime(b.heldAt)}</span>
                  <span>· {b.itemCount || 0} items</span>
                  <span className="font-semibold text-slate-700">· {formatMoney(b.total || 0)}</span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button size="sm" autoFocus={i === 0} onClick={() => onResume(b)}>
                  <Play size={12} /> Resume
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onDelete(b.id)} aria-label="Delete held bill" className="text-rose-600 hover:bg-rose-50">
                  <Trash2 size={13} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
