"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import { Badge, Button, EmptyState, ErrorState, Field, FormError, Modal, PageHeader, Spinner, inputClass, useConfirm, useToast } from "@/components/ui";

export default function RolesManager() {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    api("/api/roles").then((d) => { setError(""); setData(d); }).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function remove(role) {
    if (!(await confirm({ title: "Delete role", message: `Delete the role “${role.name}”?`, confirmLabel: "Delete", danger: true }))) return;
    try { await api(`/api/roles/${role.id}`, { method: "DELETE" }); toast.success("Role deleted."); load(); } catch (e) { toast.error(e.message); }
  }

  return (
    <div>
      <PageHeader title="Roles & Permissions" description="Define staff roles and what each role may view or manage. Assign roles in Staff Management."
        actions={data && !data.needsOrganization && <Button onClick={() => setEditing({})}><Plus size={16} /> New role</Button>} />
      {error ? <ErrorState message={error} onRetry={load} /> : !data ? <Spinner /> : data.needsOrganization ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Select an organization in the top bar to manage its roles.</p>
      ) : data.items.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white"><EmptyState title="No roles yet" message="Create roles such as Receptionist, Lab Technician or Pathologist." /></div> : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.items.map((r) => (
            <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div><p className="flex items-center gap-2 font-semibold text-slate-900">{r.name.replace(/_/g, " ")} {r.isSystem && <Badge tone="gray"><Lock size={10} className="mr-1" /> System</Badge>}</p><p className="mt-0.5 text-xs text-slate-500">{r.description || (r.isSystem ? "Full access within its scope. Cannot be modified." : "No description")}</p></div>
                {!r.isSystem && <div className="flex gap-1"><Button variant="ghost" size="icon" aria-label="Edit role" onClick={() => setEditing(r)}><Pencil size={15} /></Button><Button variant="ghost" size="icon" aria-label="Delete role" className="text-rose-500" onClick={() => remove(r)}><Trash2 size={15} /></Button></div>}
              </div>
              <p className="mt-3 text-xs text-slate-500">{r.users} staff · {r.isSystem ? "all permissions" : `${r.permissions.length} permissions`}</p>
              {!r.isSystem && <div className="mt-2 flex flex-wrap gap-1">{r.permissions.slice(0, 8).map((p) => <Badge key={p} tone="blue">{p}</Badge>)}{r.permissions.length > 8 && <Badge>+{r.permissions.length - 8}</Badge>}</div>}
            </div>
          ))}
        </div>
      )}
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
  const toggle = (k) => setPerms((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true); setError("");
    try {
      await api(isNew ? "/api/roles" : `/api/roles/${role.id}`, { method: isNew ? "POST" : "PATCH", body: { name, description, permissions: [...perms] } });
      toast.success(isNew ? "Role created." : "Role updated.");
      onSaved();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  const groups = [...new Set(catalog.map((p) => p.key.split(".")[0]))];
  return (
    <Modal open size="lg" title={isNew ? "New role" : `Edit ${role.name}`} onClose={saving ? undefined : onClose}
      footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form="role-form" loading={saving}>Save role</Button></>}>
      <form id="role-form" onSubmit={submit} className="space-y-4">
        <FormError message={error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role name" required><input required value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={inputClass} /></Field>
          <Field label="Description"><input value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} className={inputClass} /></Field>
        </div>
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
