"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/client";
import { Badge, ErrorState, PageHeader, Spinner } from "@/components/ui";

export default function RoleDetail({ id }) {
  const [role, setRole] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api(`/api/roles/${id}`).then(setRole).catch((e) => setError(e.message)); }, [id]);
  if (error) return <ErrorState message={error} />;
  if (!role) return <Spinner />;
  const groups = {};
  for (const k of role.permissions) { const [m, a] = k.split("."); (groups[m] ||= []).push(a); }
  return (
    <div className="max-w-3xl">
      <PageHeader title={role.name.replace(/_/g, " ")} description={role.description || ""}
        actions={<Link href="/roles" className="inline-flex items-center gap-1 text-sm text-blue-600"><ArrowLeft size={14} /> Roles</Link>} />
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <Badge tone={role.branchId ? "violet" : "blue"}>{role.branchId ? `Branch: ${role.branchName}` : "Organization-wide"}</Badge>
        {role.isSystem && <Badge tone="gray">System role (all permissions)</Badge>}
        {!role.editable && !role.isSystem && <Badge tone="amber">Read only for you</Badge>}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-3">
          <h2 className="mb-2 text-xs font-semibold uppercase text-slate-500">Permissions</h2>
          {role.isSystem ? <p className="text-sm text-slate-600">Full access within its scope.</p> : Object.keys(groups).length === 0 ? <p className="text-sm text-slate-400">None assigned.</p> : (
            <table className="w-full text-sm"><tbody className="divide-y divide-slate-100">{Object.entries(groups).map(([m, a]) => <tr key={m}><td className="py-1 capitalize text-slate-700">{m}</td><td className="py-1 text-right text-xs text-slate-500">{a.join(", ")}</td></tr>)}</tbody></table>
          )}
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-3">
          <h2 className="mb-2 text-xs font-semibold uppercase text-slate-500">Staff with this role ({role.staff.length})</h2>
          {role.staff.length === 0 ? <p className="text-sm text-slate-400">No staff assigned.</p> : <ul className="divide-y divide-slate-100 text-sm">{role.staff.map((u) => <li key={u.id} className="flex justify-between py-1"><span>{u.name}</span><span className="text-xs text-slate-400">{u.status}</span></li>)}</ul>}
        </section>
      </div>
    </div>
  );
}
