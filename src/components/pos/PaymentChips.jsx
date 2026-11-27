"use client";

import { KeyBadge } from "@/components/shortcut-bar";

export default function PaymentChips({
  methods = [],
  value,
  onChange,
  disabled = false,
  dark = false,
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--pos-muted)" }}>
          Payment Method
        </span>
        <KeyBadge dark={dark}>F8</KeyBadge>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {methods.map(([v, label]) => {
          const active = value === v;
          return (
            <button
              key={v}
              type="button"
              disabled={disabled}
              onClick={() => onChange(v)}
              className={`rounded-md border px-1.5 py-1 text-[11px] font-semibold transition disabled:opacity-50 ${
                active
                  ? dark
                    ? "border-emerald-500 bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500"
                    : "border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600"
                  : dark
                    ? "border-slate-700 bg-slate-800/70 text-slate-300 hover:bg-slate-800"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
