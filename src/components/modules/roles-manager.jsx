"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Eye, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import { MODULES } from "@/lib/permissions";
import { RoleViewModal } from "@/components/modules/role-detail";
import { Badge, Button, EmptyState, ErrorState, Field, FormError, Modal, PageHeader, Spinner, inputClass, useConfirm, useToast } from "@/components/ui";

/** Module chips: green = can manage (create/edit), grey = view only. */
function AccessChips({ permissions }) {
  const set = new Set(permissions);
  const chips = MODULES.filter(([k]) => set.has(`${k}.manage`) || set.has(`${k}.view`)).map(([k, label]) => [label, set.has(`${k}.manage`)]);
  if (!chips.length) return <span className="text-xs text-slate-400">No access</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map(([label, manage]) => (
        <span key={label} title={manage ? "Can view and manage" : "View only"} className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${manage ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{label}{manage ? "" : " · view"}</span>
      ))}
    </div>
  );
}

export default function RolesManager() {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => { // sidebar "Add New Role" opens the create form
    if (sp.get("new") === "1") { setEditing({}); router.replace(pathname, { scroll: false }); }
  }, [sp]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(() => {
    api("/api/roles").then((d) => { setError(""); setData(d); }).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function addStandard() {
    try { await api("/api/roles/defaults", { method: "POST", body: {} }); load(); } catch (e) { toast.error(e.message); }
  }

  async function remove(role) {
    if (!(await confirm({ title: "Delete role", message: `Delete the role “${role.name}”?`, confirmLabel: "Delete", danger: true }))) return;
    try { await api(`/api/roles/${role.id}`, { method: "DELETE" }); toast.success("Role deleted."); load(); } catch (e) { toast.error(e.message); }
  }

  return (
    <div>
      <PageHeader title="Roles & Permissions"
        actions={data && <div className="flex gap-2"><Button variant="secondary" onClick={addStandard}>Add standard roles</Button><Button onClick={() => setEditing({})}><Plus size={16} /> New role</Button></div>} />
      {error ? <ErrorState message={error} onRetry={load} /> : !data ? <Spinner /> : data.items.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white"><EmptyState title="No roles yet" message="Create roles such as Receptionist, Lab Technician or Pathologist." /></div> : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr><th className="w-10 px-3 py-2">#</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Applies to</th><th className="px-3 py-2">Staff</th><th className="px-3 py-2">Access</th><th className="w-28 px-3 py-2 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((r, n) => (
                <tr key={r.id} className="align-top hover:bg-slate-50/60">
                  <td className="px-3 py-2 text-xs text-slate-400">{n + 1}</td>
                  <td className="px-3 py-2">
                    <p className="flex items-center gap-1.5 font-bold text-slate-900">{r.name.replace(/_/g, " ")} {r.isSystem && <Badge tone="gray"><Lock size={10} className="mr-1" /> System</Badge>}</p>
                    <p className="max-w-xs text-[11px] text-slate-500">{r.description || (r.isSystem ? "Full access within its scope." : "—")}</p>
                  </td>
                  <td className="px-3 py-2"><Badge tone={r.branchId ? "violet" : "blue"}>{r.branchId ? (r.branchName || "Branch") : "All branches"}</Badge>{r.organizationName && <p className="mt-0.5 text-[11px] text-slate-400">{r.organizationName}</p>}</td>
                  <td className="px-3 py-2 font-semibold text-slate-700">{r.users}</td>
                  <td className="px-3 py-2">{r.isSystem ? <span className="text-xs font-semibold text-slate-500">All modules</span> : <AccessChips permissions={r.permissions} />}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-0.5">
                      <Button variant="ghost" size="icon" aria-label="View role" title="View" onClick={() => setViewing(r.id)}><Eye size={15} /></Button>
                      {r.editable && <><Button variant="ghost" size="icon" aria-label="Edit role" title="Edit" onClick={() => setEditing(r)}><Pencil size={15} /></Button><Button variant="ghost" size="icon" aria-label="Delete role" title="Delete" className="text-rose-500" onClick={() => remove(r)}><Trash2 size={15} /></Button></>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {viewing && <RoleViewModal id={viewing} onClose={() => setViewing(null)} />}
      {editing && data && <RoleForm role={editing} catalog={data.catalog} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function RoleForm({ role, catalog, onClose, onSaved }) {
  const toast = useToast();
  const isNew = !role.id;
  const [name, setName] = useState(role.name || "");
  const [description, setDescription] = useState(role.description || "");
  const [perms, setPerms] = useState(new Set(role.permissions || []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // ---- who is the role for? (Super: organization + branch, Org admin: branch, Branch admin: fixed) ----
  const [opts, setOpts] = useState(null);
  const [orgId, setOrgId] = useState("");
  const [branchId, setBranchId] = useState("");
  useEffect(() => {
    if (!isNew) return;
    api("/api/scope").then((o) => {
      setOpts(o);
      if (o.role === "BRANCH_ADMIN" || o.locked) return;
      setOrgId(o.organizationId || (o.organizations?.length === 1 ? o.organizations[0].id : ""));
      setBranchId(o.branchId || "");
    }).catch(() => setOpts({ organizations: [], branches: [] }));
  }, [isNew]);
  const isSuper = Boolean(opts) && !opts.locked && (opts.organizations || []).length > 0;
  const branchChoices = (opts?.branches || []).filter(
    (b) => b.status === "ACTIVE" && (!isSuper || (orgId && orgId !== "ALL" && b.organizationId === orgId)),
  );
  const toggle = (k) => setPerms((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true); setError("");
    try {
      await api(isNew ? "/api/roles" : `/api/roles/${role.id}`, { method: isNew ? "POST" : "PATCH", body: isNew
          ? { name, description, permissions: [...perms], ...(isSuper ? (orgId === "ALL" ? { applyToAll: true } : { organizationId: orgId }) : {}), ...(opts?.locked ? {} : { branchId: orgId === "ALL" ? null : branchId || null }) }
          : { name, description, permissions: [...perms] } });
      toast.success(isNew ? "Role created." : "Role updated.");
      onSaved();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  const groups = [...new Set(catalog.map((p) => p.key.split(".")[0]))];
  return (
    <Modal open size="md" title={isNew ? "New role" : `Edit ${role.name}`} onClose={saving ? undefined : onClose}
      footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form="role-form" loading={saving}>Save role</Button></>}>
      <form id="role-form" onSubmit={submit} className="space-y-4">
        <FormError message={error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role name" required><input required value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={inputClass} /></Field>
          <Field label="Description"><input value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} className={inputClass} /></Field>
        </div>
        {isNew && opts && (
          <div className="grid gap-4 rounded-xl border border-blue-100 bg-blue-50/50 p-3 sm:grid-cols-2">
            {opts.locked ? (
              <p className="text-sm text-slate-700 sm:col-span-2">This role will be created <b>only for your branch</b> ({branchChoices[0]?.name || "assigned branch"}).</p>
            ) : (
              <>
                {isSuper && (
                  <Field label="Organization" required>
                    <select value={orgId} onChange={(e) => { setOrgId(e.target.value); setBranchId(""); }} className={inputClass} required>
                      <option value="">Select organization…</option>
                      <option value="ALL">All organizations</option>
                      {opts.organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </Field>
                )}
                <Field label="Applies to" hint={orgId === "ALL" ? "Created for every branch of every organization." : "All branches, or one branch only."}>
                  <select value={orgId === "ALL" ? "" : branchId} disabled={orgId === "ALL" || (isSuper && !orgId)} onChange={(e) => setBranchId(e.target.value)} className={inputClass}>
                    <option value="">All branches</option>
                    {branchChoices.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </Field>
              </>
            )}
          </div>
        )}
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm"><thead className="bg-slate-50 text-[11px] uppercase text-slate-500"><tr><th className="px-3 py-2 text-left">Module</th><th className="px-3 py-2">View</th><th className="px-3 py-2">Manage</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{groups.map((g) => {
              const view = catalog.find((p) => p.key === `${g}.view`); const manage = catalog.find((p) => p.key === `${g}.manage`);
              return <tr key={g}><td className="px-3 py-2 font-medium capitalize text-slate-700">{g}</td>
                {[view, manage].map((p, i) => <td key={i} className="px-3 py-2 text-center">{p && <input type="checkbox" aria-label={p.name} checked={perms.has(p.key)} onChange={() => toggle(p.key)} className="h-4 w-4 rounded border-slate-300" />}</td>)}</tr>;
            })}</tbody></table>
        </div>
      </form>
    </Modal>
  );
}
