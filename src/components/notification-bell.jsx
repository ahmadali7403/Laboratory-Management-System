"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { api, formatDateTime } from "@/lib/client";

/**
 * Top-bar bell: opens a small panel right below the button (not a new page).
 * Closes on outside click or Escape. "View all" still links to /notifications.
 */
export default function NotificationBell({ unread: initialUnread = 0 }) {
  const router = useRouter();
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ loading: false, error: "", items: [], unread: initialUnread });

  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    api("/api/notifications?pageSize=8")
      .then((d) => setState({ loading: false, error: "", items: d.items, unread: d.unread }))
      .catch((e) => setState((s) => ({ ...s, loading: false, error: e.message })));
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  async function markRead(body) {
    try { await api("/api/notifications", { method: "PATCH", body }); load(); router.refresh(); } catch { /* shown on next load */ }
  }
  const count = open ? state.unread : initialUnread;

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Notifications" aria-haspopup="dialog" aria-expanded={open} title="Notifications"
        className={`relative rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 ${open ? "bg-slate-50" : ""}`}>
        <Bell size={15} />
        {count > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">{count > 99 ? "99+" : count}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Notifications" className="fixed inset-x-2 top-12 z-50 rounded-xl border border-slate-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1 sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <p className="text-sm font-semibold text-slate-800">Notifications {state.unread > 0 && <span className="text-xs font-normal text-slate-400">· {state.unread} unread</span>}</p>
            <button type="button" disabled={!state.unread} onClick={() => markRead({ all: true })} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 disabled:text-slate-300"><CheckCheck size={13} /> Mark all read</button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {state.error ? <p className="px-3 py-6 text-center text-xs text-rose-600">{state.error} <button onClick={load} className="font-semibold underline">Retry</button></p>
              : state.loading && state.items.length === 0 ? <p className="px-3 py-6 text-center text-xs text-slate-400">Loading…</p>
              : state.items.length === 0 ? <p className="px-3 py-8 text-center text-xs text-slate-400">You&apos;re all caught up.</p> : (
                <ul className="divide-y divide-slate-100">
                  {state.items.map((n) => (
                    <li key={n.id} className={`flex items-start gap-2 px-3 py-2 ${n.isRead ? "" : "bg-blue-50/50"}`}>
                      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.isRead ? "bg-slate-200" : "bg-blue-500"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-800">{n.title}</p>
                        <p className="line-clamp-2 text-xs text-slate-600">{n.message}</p>
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          {formatDateTime(n.createdAt)}
                          {n.link && <> · <Link href={n.link} className="font-semibold text-blue-600" onClick={() => { setOpen(false); if (!n.isRead) markRead({ ids: [n.id] }); }}>Open</Link></>}
                          {!n.isRead && <> · <button type="button" className="font-semibold text-slate-500 hover:text-slate-800" onClick={() => markRead({ ids: [n.id] })}>Mark read</button></>}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
          </div>
          <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-slate-100 px-3 py-2 text-center text-xs font-semibold text-blue-600 hover:bg-slate-50">View all notifications</Link>
        </div>
      )}
    </div>
  );
}
