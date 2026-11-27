"use client";

import DataModule from "@/components/data-module";
import { Badge } from "@/components/ui";
import { formatDateTime } from "@/lib/client";

const ACTION_OPTS = [
  "LOGIN_SUCCESS",
  "LOGIN_PIN",
  "LOGIN_FAILED",
  "LOGIN_RATE_LIMITED",
  "SCREEN_UNLOCK",
  "DISCOUNT_OVERRIDE",
  "SALE_VOID",
  "SALE_RETURN",
  "SHIFT_OPEN",
  "SHIFT_CLOSE",
  "ROLE_UPDATED",
].map((a) => ({ value: a, label: a.replace(/_/g, " ") }));

export default function AuditLogsView({ scope }) {
  const config = {
    title: "Security & Audit Logs",
    description: "Track logins, PIN overrides, voided bills, refunds, cashier shifts, and role changes.",
    singular: "Audit log",
    plural: "audit logs",
    endpoint: "/api/audit-logs",
    searchPlaceholder: "Search actor, action summary, or resource...",
    filters: [{ key: "action", label: "All actions", options: ACTION_OPTS }],
    columns: [
      { label: "Time", render: (r) => formatDateTime(r.createdAt) },
      { label: "Actor", render: (r) => <div><p className="font-semibold text-slate-800">{r.actorName}</p><p className="text-[11px] text-slate-400">{r.actorRole}</p></div> },
      {
        label: "Action",
        render: (r) => (
          <Badge tone={r.action.includes("FAIL") || r.action.includes("VOID") || r.action.includes("RATE") ? "red" : r.action.includes("OVERRIDE") || r.action.includes("RETURN") ? "amber" : "blue"}>
            {r.action.replace(/_/g, " ")}
          </Badge>
        ),
      },
      { label: "Summary", render: (r) => <span className="text-slate-700">{r.summary}</span> },
      { label: "Branch", render: (r) => r.branch?.name || "Organization / Global" },
      { label: "IP", render: (r) => <span className="font-mono text-xs text-slate-400">{r.ip || "—"}</span> },
    ],
  };

  return <DataModule config={config} scope={scope} />;
}
