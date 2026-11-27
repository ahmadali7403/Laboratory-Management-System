"use client";

import { Undo2, Trash2 } from "lucide-react";

export default function CartPanel({
  title,
  count = 0,
  canUndo = false,
  onUndo,
  onClear,
  dark = false,
  children,
}) {
  return (
    <section
      className="pos-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border shadow-sm"
    >
      <div
        className="flex shrink-0 items-center justify-between border-b px-2.5 py-1.5"
        style={{ borderColor: "var(--pos-border)" }}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--pos-muted)" }}>
            {title}
          </h2>
          <span
            className={`rounded-full px-2 py-px text-[10px] font-bold tabular-nums ${
              dark ? "bg-blue-500/20 text-blue-300" : "bg-blue-50 text-blue-700"
            }`}
          >
            {count}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {canUndo && (
            <button
              type="button"
              tabIndex={-1}
              onClick={onUndo}
              title="Undo last cart action (Ctrl+Z)"
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold text-blue-500 hover:bg-blue-500/10"
            >
              <Undo2 size={11} /> Undo
            </button>
          )}
          {count > 0 && (
            <button
              type="button"
              tabIndex={-1}
              onClick={onClear}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold text-rose-500 hover:bg-rose-500/10"
            >
              <Trash2 size={11} /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {children}
      </div>
    </section>
  );
}
