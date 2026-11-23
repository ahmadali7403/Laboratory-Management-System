"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import DataMenu from "@/components/data-tools";
import ParametersEditor from "@/components/parameters-editor";
import { Button, EmptyState, ErrorState, Field, FormError, Modal, PageHeader, Pagination, Spinner, inputClass, useConfirm, useDebounced, useToast } from "@/components/ui";

/**
 * Config-driven list + create/edit/delete screen used by every module.
 * Authorization is NOT decided here: the server filters data and rejects
 * forbidden writes. This component only shapes the UI.
 */
export default function DataModule({ config, scope }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const [state, setState] = useState({ key: "", error: "", items: [], total: 0, pageSize: 15, extra: null });
  const [form, setForm] = useState(null); // { mode, row }

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const filterKey = JSON.stringify(filters);

  const reqKey = JSON.stringify([config.endpoint, dq, filters, page, tick]);
  const loading = state.key !== reqKey;

  useEffect(() => {
    const ctrl = new AbortController();
    const params = new URLSearchParams({ page: String(page) });
    if (dq) params.set("q", dq);
    for (const [k, v] of Object.entries({ ...(config.baseParams || {}), ...filters })) if (v) params.set(k, v);
    api(`${config.endpoint}?${params}`, { signal: ctrl.signal })
      .then((d) => setState({ key: reqKey, error: "", items: d.items, total: d.total, pageSize: d.pageSize, extra: d }))
      .catch((e) => e.name !== "AbortError" && setState((s) => ({ ...s, key: reqKey, error: e.message })));
    return () => ctrl.abort();
  }, [reqKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const ctx = useMemo(() => ({ refresh, toast, confirm, scope }), [refresh, toast, confirm, scope]);

  const canEdit = (row) => (config.form ? (config.canEditRow ? config.canEditRow(row, scope) : true) : false);

  async function remove(row) {
    const ok = await confirm({
      title: `Delete ${config.singular}`,
      message: config.deleteMessage ? config.deleteMessage(row) : `This ${config.singular.toLowerCase()} will be permanently deleted. This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`${config.endpoint}/${row.id}`, { method: "DELETE" });
      toast.success(`${config.singular} deleted.`);
      refresh();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const hasActions = config.form || (config.rowActions && config.rowActions.length > 0);
  const headerActions = (
    <>
      <Button variant="secondary" onClick={refresh} aria-label="Refresh"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /></Button>
      {config.headerActions?.(ctx)}
      <DataMenu config={config} scope={scope} params={{ ...(config.baseParams || {}), ...(dq ? { q: dq } : {}), ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) }} onRestored={refresh} />
      {config.form && (!config.canCreate || config.canCreate(scope)) && (
        <Button onClick={() => setForm({ mode: "create" })}><Plus size={16} /> {config.createLabel || `Add ${config.singular}`}</Button>
      )}
    </>
  );

  return (
    <div>
      <PageHeader title={config.title} description={config.description} actions={headerActions} />
      {config.banner?.(scope)}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder={config.searchPlaceholder || "Search..."} className={`${inputClass} pl-9`} aria-label="Search" />
          </div>
          {(config.filters || []).map((f) => (
            <select key={f.key} value={filters[f.key] || ""} onChange={(e) => { setFilters((s) => ({ ...s, [f.key]: e.target.value })); setPage(1); }} className={`${inputClass} sm:w-48`} aria-label={f.label}>
              <option value="">{f.label}</option>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ))}
        </div>

        {loading && !state.items.length ? <Spinner /> : !loading && state.error ? <ErrorState message={state.error} onRetry={refresh} /> : (
          <>
            {state.items.length === 0 ? (
              <EmptyState title={q || filterKey !== "{}" ? "No matching records" : `No ${config.plural || "records"} yet`} message={q || filterKey !== "{}" ? "Try different search words or filters." : config.emptyMessage} />
            ) : (
              <>
                {/* Compact cards replace wide tables on phones and tablets. */}
                <div className={`grid gap-3 p-3 sm:grid-cols-2 xl:hidden ${loading ? "opacity-60" : ""}`}>
                  {state.items.map((row) => (
                    <article key={row.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                      <dl className="grid min-w-0 grid-cols-1 gap-2">
                        {config.columns.map((c, index) => (
                          <div key={c.label} className={`min-w-0 ${index === 0 ? "border-b border-slate-100 pb-2" : ""}`}>
                            <dt className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{c.label}</dt>
                            <dd className="min-w-0 break-words text-sm text-slate-700">{c.render ? c.render(row, scope) : row[c.key] ?? "—"}</dd>
                          </div>
                        ))}
                      </dl>
                      {hasActions && <div className="mt-3 flex flex-wrap items-center justify-end gap-1.5 border-t border-slate-100 pt-2">
                        {(config.rowActions || []).map((a) => (!a.show || a.show(row, scope)) && (
                          a.href ? <a key={a.label} href={a.href(row)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">{a.icon && <a.icon size={13} />}{a.label}</a>
                            : <Button key={a.label} variant={a.variant || "secondary"} size="sm" onClick={() => a.onClick(row, ctx)}>{a.icon && <a.icon size={13} />}{a.label}</Button>
                        ))}
                        {canEdit(row) && <Button variant="ghost" size="icon" onClick={() => setForm({ mode: "edit", row })} aria-label="Edit" title="Edit"><Pencil size={15} /></Button>}
                        {config.form && !config.noDelete && canEdit(row) && <Button variant="ghost" size="icon" onClick={() => remove(row)} aria-label="Delete" title="Delete" className="text-rose-500 hover:bg-rose-50"><Trash2 size={15} /></Button>}
                      </div>}
                    </article>
                  ))}
                </div>

                {/* Full table is reserved for wide screens; cells wrap instead of forcing page overflow. */}
                <div className={`hidden min-w-0 xl:block ${loading ? "opacity-60" : ""}`}>
                  <table className="w-full table-fixed text-left text-sm">
                    <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        {config.columns.map((c) => <th key={c.label} className={`break-words px-3 py-3 ${c.className || ""}`}>{c.label}</th>)}
                        {hasActions && <th className="w-40 px-3 py-3 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {state.items.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/60">
                          {config.columns.map((c) => <td key={c.label} className={`break-words px-3 py-3 align-middle text-slate-700 ${c.className || ""}`}>{c.render ? c.render(row, scope) : row[c.key] ?? "—"}</td>)}
                          {hasActions && <td className="px-2 py-3"><div className="flex flex-wrap items-center justify-end gap-1">
                            {(config.rowActions || []).map((a) => (!a.show || a.show(row, scope)) && (
                              a.href ? <a key={a.label} href={a.href(row)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">{a.icon && <a.icon size={12} />}{a.label}</a>
                                : <Button key={a.label} variant={a.variant || "secondary"} size="sm" onClick={() => a.onClick(row, ctx)}>{a.icon && <a.icon size={13} />}{a.label}</Button>
                            ))}
                            {canEdit(row) && <Button variant="ghost" size="icon" onClick={() => setForm({ mode: "edit", row })} aria-label="Edit" title="Edit"><Pencil size={15} /></Button>}
                            {config.form && !config.noDelete && canEdit(row) && <Button variant="ghost" size="icon" onClick={() => remove(row)} aria-label="Delete" title="Delete" className="text-rose-500 hover:bg-rose-50"><Trash2 size={15} /></Button>}
                          </div></td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
        <Pagination page={page} pageSize={state.pageSize} total={state.total} onChange={setPage} />
      </div>
      {config.footer?.(state.extra)}

      {form && <RecordForm config={config} scope={scope} mode={form.mode} row={form.row} onClose={() => setForm(null)} onSaved={() => { setForm(null); refresh(); }} />}
    </div>
  );
}

function initialValues(config, scope, mode, row) {
  const v = {};
  for (const f of config.form.fields) {
    if (mode === "edit" && row) {
      v[f.name] = f.init ? f.init(row) : f.type === "date" ? (row[f.name] ? String(row[f.name]).slice(0, 10) : "") : f.type === "checkbox" ? Boolean(row[f.name]) : row[f.name] ?? "";
    } else {
      v[f.name] = f.default !== undefined ? f.default : f.type === "checkbox" ? false : f.type === "params" ? [] : "";
    }
  }
  return v;
}

function RecordForm({ config, scope, mode, row, onClose, onSaved }) {
  const toast = useToast();
  const [values, setValues] = useState(() => initialValues(config, scope, mode, row));
  const branchMode = config.form.branch; // 'required' | 'optional' | undefined
  const showBranch = mode === "create" && branchMode && scope.role !== "BRANCH_ADMIN" && (branchMode === "optional" || !scope.branchId);
  const [branchId, setBranchId] = useState(branchMode === "optional" ? "" : scope.branchId || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (name, value) => setValues((s) => ({ ...s, [name]: value }));

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const payload = config.form.toPayload ? config.form.toPayload(values) : { ...values };
      if (showBranch) payload.branchId = branchId || null;
      await api(mode === "create" ? config.endpoint : `${config.endpoint}/${row.id}`, { method: mode === "create" ? "POST" : "PATCH", body: payload });
      toast.success(`${config.singular} ${mode === "create" ? "created" : "updated"}.`);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open size="lg" title={`${mode === "create" ? "New" : "Edit"} ${config.singular}`} onClose={saving ? undefined : onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="submit" form="record-form" loading={saving}>{mode === "create" ? "Create" : "Save changes"}</Button>
      </>}>
      <form id="record-form" onSubmit={submit}>
        <FormError message={error} />
        <div className="grid gap-4 sm:grid-cols-2">
          {showBranch && (
            <Field label="Branch" required={branchMode === "required"} className="sm:col-span-2" hint={branchMode === "optional" ? "Choose “All branches” to share it with every branch of the organization." : undefined}>
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)} required={branchMode === "required"} className={inputClass}>
                <option value="">{branchMode === "optional" ? "All branches (organization-wide)" : "Select a branch"}</option>
                {scope.branches.map((b) => <option key={b.id} value={b.id}>{scope.role === "SUPER_ADMIN" && !scope.organizationId ? `${b.organizationName} — ${b.name}` : b.name}</option>)}
              </select>
            </Field>
          )}
          {config.form.fields.filter((f) => !(mode === "edit" && f.createOnly) && !(mode === "create" && f.editOnly) && (!f.show || f.show(values))).map((f) => (
            f.type === "params" ? <ParametersEditor key={f.name} label={f.label} value={values[f.name]} onChange={(v) => set(f.name, v)} /> : <Field key={f.name} label={f.label} required={f.required} hint={f.hint} className={f.type === "textarea" || f.wide ? "sm:col-span-2" : ""}>
              {f.type === "select" ? (
                <select value={values[f.name]} onChange={(e) => set(f.name, e.target.value)} required={f.required} className={inputClass}>
                  {!f.required && <option value="">—</option>}
                  {f.required && values[f.name] === "" && <option value="">Select...</option>}
                  {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === "textarea" ? (
                <textarea value={values[f.name]} onChange={(e) => set(f.name, e.target.value)} rows={3} maxLength={f.maxLength || 500} className={`${inputClass} h-auto py-2`} />
              ) : f.type === "checkbox" ? (
                <span className="flex h-10 items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={values[f.name]} onChange={(e) => set(f.name, e.target.checked)} className="h-4 w-4 rounded border-slate-300" /> {f.checkboxLabel || "Enabled"}</span>
              ) : (
                <input type={f.type || "text"} value={values[f.name]} onChange={(e) => set(f.name, e.target.value)} required={f.required} step={f.step || (f.type === "number" ? "any" : undefined)} min={f.min} maxLength={f.maxLength || 200} placeholder={f.placeholder} className={inputClass} />
              )}
            </Field>
          ))}
        </div>
      </form>
    </Modal>
  );
}
