"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3, Bell, Boxes, Building2, ChevronDown, ChevronsLeft, ChevronsRight, ClipboardList, Circle,
  DatabaseBackup, Droplets, FileText, FlaskConical, GitBranch, LayoutDashboard, Menu, PanelLeftClose,
  Receipt, Search, Settings, ShieldCheck, ShoppingCart, SlidersHorizontal, Stethoscope, TestTube, Truck,
  UserCog, Users, Wallet, X,
} from "lucide-react";

// Only the icons the menu really uses are bundled (importing "* as Icons" ships ~1500 icons).
export const ICONS = {
  BarChart3, Bell, Boxes, Building2, ClipboardList, DatabaseBackup, Droplets, FileText, FlaskConical,
  GitBranch, LayoutDashboard, Receipt, Search, Settings, ShieldCheck, ShoppingCart, SlidersHorizontal,
  Stethoscope, TestTube, Truck, UserCog, Users, Wallet,
};

const KEY = "labos:sidebar"; // "expanded" | "collapsed" | "hidden"

export default function Sidebar({ items, unread, roleLabel }) {
  const pathname = usePathname();
  const [mode, setMode] = useState("expanded");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState(null); // only one dropdown open at a time
  const [navQuery, setNavQuery] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (["expanded", "collapsed", "hidden"].includes(saved)) setMode(saved);
    } catch { /* storage blocked */ }
  }, []);
  function update(next) {
    setMode(next);
    try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
  }

  // Items with a query string (e.g. "?new=1") open a create form and are never highlighted.
  const isActive = (item) => {
    const href = item.href;
    if (href.includes("?")) return false;
    if (item.exact || href.endsWith("/dashboard")) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  function Leaf({ item, compact, nested }) {
    const Icon = nested ? Circle : ICONS[item.icon] || Circle;
    const active = isActive(item);
    return (
      <Link
        key={item.href + item.label}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        title={compact ? item.label : undefined}
        aria-label={item.label}
        className={`group relative flex items-center rounded-md text-[13px] font-medium transition ${compact ? "mx-auto h-8 w-8 justify-center" : `gap-2.5 px-2.5 ${nested ? "ml-5 py-1 text-[12px]" : "py-1.5"}`} ${active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}
      >
        <Icon size={nested ? 6 : compact ? 16 : 15} className={`shrink-0 ${nested ? "fill-current" : ""}`} />
        {!compact && <span className="flex-1 truncate">{item.label}</span>}
        {item.href === "/notifications" && unread > 0 && (
          compact
            ? <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-rose-500" />
            : <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>
        )}
        {compact && (
          <span role="tooltip" className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs text-white shadow-lg group-hover:block">
            {item.label}
          </span>
        )}
      </Link>
    );
  }

  function Nav({ compact }) {
    const needle = navQuery.trim().toLowerCase();
    const matches = (item) => !needle || item.label.toLowerCase().includes(needle) || (item.group || "").toLowerCase().includes(needle);
    return (
      <nav className="scroll-dark flex-1 space-y-0.5 overflow-y-auto overflow-x-visible px-2 py-2" aria-label="Main navigation">
        {!compact && (
          <div className="relative mb-1.5">
            <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              placeholder="Search menu..."
              aria-label="Search menu"
              className="h-7 w-full rounded-md border border-white/10 bg-white/5 pl-7 pr-2 text-[12px] text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
        )}
        {items.map((item, i) => {
          if (item.section)
            return compact
              ? <hr key={i} className="mx-2 my-2 border-white/10" />
              : needle ? null : <p key={i} className="px-2.5 pb-0.5 pt-3 text-[9px] font-bold uppercase tracking-widest text-slate-500">{item.section}</p>;
          if (item.children) {
            if (compact) return item.children.map((c) => Leaf({ item: { ...c, icon: item.icon }, compact: true }));
            const Icon = ICONS[item.icon] || Circle;
            const kids = needle && !matches(item) ? item.children.filter(matches) : item.children;
            if (needle && kids.length === 0) return null;
            const hasActive = item.children.some((c) => isActive(c));
            const open = needle ? true : (openGroup === item.group || (openGroup === null && hasActive));
            return (
              <div key={item.group}>
                <button
                  type="button"
                  onClick={() => setOpenGroup(open ? "" : item.group)}
                  aria-expanded={open}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition hover:bg-white/10 hover:text-white ${hasActive ? "text-white" : "text-slate-300"}`}
                >
                  <Icon size={15} className="shrink-0" />
                  <span className="flex-1 truncate text-left">{item.group}</span>
                  <ChevronDown size={13} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
                </button>
                <div className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`} inert={!open}>
                  <div className="overflow-hidden">
                    {kids.map((c) => Leaf({ item: c, nested: true }))}
                  </div>
                </div>
              </div>
            );
          }
          if (!matches(item)) return null;
          return Leaf({ item, compact });
        })}
      </nav>
    );
  }

  function Panel({ compact, mobile }) {
    return (
      <div className={`flex h-full flex-col bg-slate-900 ${compact ? "w-12" : "w-52"}`}>
        <div className={`flex h-11 shrink-0 items-center border-b border-white/10 ${compact ? "justify-center" : "gap-2 px-3"}`}>
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white"><FlaskConical size={15} /></span>
          {!compact && (
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-[13px] font-bold text-white">LabOS</p>
              <p className="truncate text-[9px] text-slate-400">{roleLabel}</p>
            </div>
          )}
          {!compact && (
            <button type="button" onClick={() => (mobile ? setMobileOpen(false) : update("collapsed"))} aria-label={mobile ? "Close menu" : "Collapse sidebar"} title={mobile ? "Close" : "Collapse"} className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white">
              {mobile ? <X size={15} /> : <ChevronsLeft size={15} />}
            </button>
          )}
        </div>
        {compact && (
          <div className="shrink-0 border-b border-white/10 p-1.5">
            <button type="button" onClick={() => update("expanded")} aria-label="Expand sidebar" title="Expand" className="mx-auto flex h-7 w-8 items-center justify-center rounded-md text-slate-300 hover:bg-white/10 hover:text-white"><ChevronsRight size={16} /></button>
          </div>
        )}
        {Nav({ compact })}
        {compact && (
          <div className="shrink-0 space-y-1 border-t border-white/10 p-2">
            <button type="button" onClick={() => update("hidden")} aria-label="Hide sidebar" title="Hide sidebar" className="mx-auto flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white"><PanelLeftClose size={16} /></button>
          </div>
        )}
        {!compact && !mobile && (
          <div className="shrink-0 border-t border-white/10 p-2">
            <button type="button" onClick={() => update("hidden")} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-slate-400 hover:bg-white/10 hover:text-white"><PanelLeftClose size={14} /> Hide sidebar</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {mode !== "hidden" && <div className="hidden shrink-0 lg:block print:hidden">{Panel({ compact: mode === "collapsed" })}</div>}
      <button
        onClick={() => (window.matchMedia("(min-width: 1024px)").matches ? update("expanded") : setMobileOpen(true))}
        aria-label="Open menu"
        title="Open menu"
        className={`fixed left-2 top-1.5 z-40 rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 shadow-sm print:hidden ${mode === "hidden" ? "" : "lg:hidden"}`}
      >
        <Menu size={16} />
      </button>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden print:hidden">
          <div className="h-full">{Panel({ mobile: true })}</div>
          <button aria-label="Close menu" className="flex-1 bg-slate-950/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  );
}
