"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ClipboardList, Footprints, Plus, Receipt, Stethoscope, TestTube, UserCog, UserPlus, Wallet, Boxes } from "lucide-react";

const ICONS = { UserPlus, Footprints, ClipboardList, Receipt, Wallet, TestTube, Stethoscope, Boxes, UserCog };

/** Floating (+) shortcut. `actions` are built on the server from the user's own navigation. */
export default function QuickAdd({ actions }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  if (!actions.length) return null;
  return (
    <div ref={ref} className="relative shrink-0 print:hidden">
      {open && (
        <div role="menu" className="absolute left-0 top-9 z-50 w-52 rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
          <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Quick add</p>
          {actions.map((a) => {
            const Icon = ICONS[a.icon] || Plus;
            return (
              <Link key={a.href} role="menuitem" href={a.href} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded px-2.5 py-1.5 text-[13px] text-slate-700 hover:bg-blue-50 hover:text-blue-700">
                <Icon size={14} className="shrink-0" /> {a.label}
              </Link>
            );
          })}
        </div>
      )}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Quick add" aria-expanded={open} title="Quick add" className={`flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white shadow transition hover:bg-blue-700 ${open ? "rotate-45" : ""}`}>
        <Plus size={16} />
      </button>
    </div>
  );
}
