"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, GitBranch, Lock } from "lucide-react";
import { api } from "@/lib/client";
import { inputClass, useToast } from "@/components/ui";

/**
 * Lets Super Admin / Organization Admin narrow the view. The choice is only a
 * request: the server validates it again on every request.
 */
export default function ScopeSelector({ role, organizationId, branchId, locked, branchName }) {
  const router = useRouter();
  const toast = useToast();
  const [opts, setOpts] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (locked) return;
    api("/api/scope").then(setOpts).catch(() => {});
  }, [locked, organizationId]);

  async function choose(next) {
    setBusy(true);
    try {
      await api("/api/scope", { method: "POST", body: next });
      router.refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (locked) {
    return <span className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600"><Lock size={13} /> {branchName || "Assigned branch"}</span>;
  }
  if (!opts) return <span className="h-10 w-48 animate-pulse rounded-lg bg-slate-100" />;

  const branches = opts.branches.filter((b) => !organizationId || b.organizationId === organizationId);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {role === "SUPER_ADMIN" && (
        <label className="flex items-center gap-2"><Building2 size={15} className="text-slate-400" />
          <select disabled={busy} value={organizationId || ""} onChange={(e) => choose({ organizationId: e.target.value || null, branchId: null })} className={`${inputClass} h-9 w-44`} aria-label="Organization">
            <option value="">All organizations</option>
            {opts.organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
      )}
      <label className="flex items-center gap-2"><GitBranch size={15} className="text-slate-400" />
        <select disabled={busy} value={branchId || ""} onChange={(e) => choose({ organizationId, branchId: e.target.value || null })} className={`${inputClass} h-9 w-44`} aria-label="Branch">
          <option value="">All branches</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}{b.status !== "ACTIVE" ? " (inactive)" : ""}</option>)}
        </select>
      </label>
    </div>
  );
}
