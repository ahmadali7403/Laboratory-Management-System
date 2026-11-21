"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import * as Icons from "lucide-react";
import LogoutButton from "@/components/logout-button";

export default function Sidebar({ items, user, unread }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href) => {
    if (href.endsWith("/dashboard") || href === "/dashboard") return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const nav = (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3" aria-label="Main navigation">
      {items.map((item, i) => {
        if (item.section) return <p key={i} className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">{item.section}</p>;
        const Icon = Icons[item.icon] || Icons.Circle;
        const active = isActive(item.href);
        return (
          <Link key={item.href + item.label} href={item.href} onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${active ? "bg-blue-600 text-white shadow-sm" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}>
            <Icon size={17} className="shrink-0" />
            <span className="flex-1 truncate">{item.label}</span>
            {item.href === "/notifications" && unread > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>}
          </Link>
        );
      })}
    </nav>
  );

  const panel = (
    <div className="flex h-full w-64 flex-col bg-slate-900">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white"><Icons.FlaskConical size={19} /></span>
        <div><p className="text-sm font-bold text-white">LabOS</p><p className="text-[10px] text-slate-400">{user.roleLabel}</p></div>
      </div>
      {nav}
      <div className="shrink-0 border-t border-white/10 p-3">
        <div className="mb-2 px-1"><p className="truncate text-sm font-semibold text-white">{user.name}</p><p className="truncate text-[11px] text-slate-400">{user.subtitle}</p></div>
        <LogoutButton variant="dark" />
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden shrink-0 lg:block print:hidden">{panel}</div>
      <button onClick={() => setOpen(true)} aria-label="Open menu" className="fixed left-3 top-3 z-40 rounded-lg border border-slate-200 bg-white p-2 text-slate-700 shadow lg:hidden print:hidden"><Icons.Menu size={18} /></button>
      {open && (
        <div className="fixed inset-0 z-50 flex lg:hidden print:hidden">
          <div className="h-full">{panel}</div>
          <button aria-label="Close menu" className="flex-1 bg-slate-950/50" onClick={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}
