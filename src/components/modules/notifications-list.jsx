"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { api, formatDateTime } from "@/lib/client";
import { Badge, Button, EmptyState, ErrorState, PageHeader, Pagination, Spinner, useToast } from "@/components/ui";

export default function NotificationsList() {
  const toast = useToast();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ loading: true, error: "", items: [], total: 0, unread: 0, pageSize: 20 });

  const load = useCallback(() => {
    api(`/api/notifications?page=${page}`).then((d) => setState({ loading: false, error: "", ...d })).catch((e) => setState((s) => ({ ...s, loading: false, error: e.message })));
  }, [page]);
  useEffect(load, [load]);

  async function markRead(body) {
    try { await api("/api/notifications", { method: "PATCH", body }); load(); router.refresh(); } catch (e) { toast.error(e.message); }
  }

  return (
    <div>
      <PageHeader title="Notifications" description={`${state.unread} unread`} actions={<Button variant="secondary" disabled={!state.unread} onClick={() => markRead({ all: true })}><CheckCheck size={15} /> Mark all read</Button>} />
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {state.loading ? <Spinner /> : state.error ? <ErrorState message={state.error} onRetry={load} /> : state.items.length === 0 ? <EmptyState title="You're all caught up" message="New orders, rejected samples, ready reports and low stock appear here." /> : (
          <ul className="divide-y divide-slate-100">
            {state.items.map((n) => (
              <li key={n.id} className={`flex items-start gap-3 px-5 py-4 ${n.isRead ? "" : "bg-blue-50/40"}`}>
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${n.isRead ? "bg-slate-100 text-slate-400" : "bg-blue-100 text-blue-600"}`}><Bell size={16} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">{n.title} {n.branch?.name && <Badge className="ml-1">{n.branch.name}</Badge>}</p>
                  <p className="text-sm text-slate-600">{n.message}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(n.createdAt)}{n.link && <> · <Link href={n.link} className="font-semibold text-blue-600" onClick={() => !n.isRead && markRead({ ids: [n.id] })}>Open</Link></>}</p>
                </div>
                {!n.isRead && <Button variant="ghost" size="sm" onClick={() => markRead({ ids: [n.id] })}>Mark read</Button>}
              </li>
            ))}
          </ul>
        )}
        <Pagination page={page} pageSize={state.pageSize} total={state.total} onChange={setPage} />
      </div>
    </div>
  );
}
