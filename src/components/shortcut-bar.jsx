"use client";

import { Keyboard } from "lucide-react";
import { Modal } from "@/components/ui";
import { LAB_SHORTCUTS, POS_SHORTCUTS } from "@/lib/shortcuts";

export function KeyBadge({ children, dark = false, className = "" }) {
  return (
    <kbd
      className={`inline-flex items-center justify-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none ${
        dark
          ? "border-slate-600 bg-slate-800 text-slate-200"
          : "border-slate-300 bg-slate-100 text-slate-700"
      } ${className}`}
    >
      {children}
    </kbd>
  );
}

const DEFAULT_POS_BAR = [
  ["F1", "Help"],
  ["F2", "New"],
  ["F3", "Search"],
  ["F4", "Customer"],
  ["F5", "Hold"],
  ["F6", "Disc"],
  ["F8", "Pay Mode"],
  ["F9", "Save+Print"],
  ["F10", "Save"],
  ["Ctrl+Z", "Undo"],
  ["Ctrl+Del", "Remove"],
  ["Esc", "Cancel"],
];

export function ShortcutBar({
  items = DEFAULT_POS_BAR,
  onTrigger,
  dark = false,
  className = "",
}) {
  return (
    <footer
      aria-label="Keyboard shortcuts"
      className={`flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-1 border-t px-2.5 py-1 text-[11px] select-none print:hidden ${
        dark
          ? "border-slate-800 bg-slate-900/95 text-slate-300"
          : "border-slate-200 bg-slate-50 text-slate-600"
      } ${className}`}
    >
      <span className="inline-flex items-center gap-1 font-semibold opacity-80">
        <Keyboard size={12} /> Keys:
      </span>
      {items.map(([k, label]) => (
        <button
          key={k}
          type="button"
          tabIndex={-1}
          onClick={() => onTrigger?.(k)}
          className={`inline-flex items-center gap-1 rounded px-1 py-0.5 transition ${
            onTrigger
              ? dark
                ? "hover:bg-slate-800"
                : "hover:bg-slate-200/70"
              : "cursor-default"
          }`}
        >
          <KeyBadge dark={dark}>{k}</KeyBadge>
          <span className="whitespace-nowrap font-medium">{label}</span>
        </button>
      ))}
    </footer>
  );
}

export function ShortcutsHelpModal({ open, onClose, navLinks = [] }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Keyboard Shortcuts (Mouseless Guide)"
      subtitle="Operate Pharmacy POS, Lab POS, Result Entry, and navigation using keyboard only."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            POS &amp; Global Controls
          </h3>
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {POS_SHORTCUTS.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs">
                <span className="font-medium text-slate-700">{s.label}</span>
                <KeyBadge>{s.key}</KeyBadge>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              Laboratory &amp; Reports
            </h3>
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {LAB_SHORTCUTS.map((s) => (
                <div key={s.key} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs">
                  <span className="font-medium text-slate-700">{s.label}</span>
                  <KeyBadge>{s.key}</KeyBadge>
                </div>
              ))}
            </div>
          </div>

          {navLinks.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                Your Role Navigation (Alt + 1..9)
              </h3>
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {navLinks.map((n, idx) => (
                  <div key={n.href} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs">
                    <span className="truncate font-medium text-slate-700">{n.label}</span>
                    <KeyBadge>Alt+{idx + 1}</KeyBadge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
