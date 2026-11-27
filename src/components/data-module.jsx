"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import { cleanCnicInput, cleanPersonName, cleanPhoneInput } from "@/lib/validators";
import DataMenu from "@/components/data-tools";
import { useRecordView } from "@/components/record-view";
import ParametersEditor from "@/components/parameters-editor";
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  FormError,
  Modal,
  PAGE_SIZES,
  PageHeader,
  PageSizeSelect,
  Pagination,
  Select,
  Spinner,
  inputClass,
  useConfirm,
  useDebounced,
  useToast,
} from "@/components/ui";

// Remembers the last pages the user opened so coming back to a tab is instant
// (stale-while-revalidate: cached rows show immediately, fresh rows replace them).
const RESPONSE_CACHE = new Map();
const PAGE_SIZE_KEY = "labos:pageSize";

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
  const [pageSize, setPageSize] = useState(10);
  const [ready, setReady] = useState(false); // page size is read from the browser before the first request
  const [tick, setTick] = useState(0);
  const [rowIdx, setRowIdx] = useState(-1);
  const [state, setState] = useState({
    key: "",
    error: "",
    items: [],
    total: 0,
    pageSize: 10,
    extra: null,
  });
  const [form, setForm] = useState(null); // { mode, row }
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (searchParams.get("new") === "1" && config.form && !writeBlocked(config, scope) && (!config.canCreate || config.canCreate(scope))) {
      setForm({ mode: "create" });
      router.replace(pathname, { scroll: false });
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    RESPONSE_CACHE.clear();
    setTick((t) => t + 1);
  }, []);
  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(PAGE_SIZE_KEY));
      if (PAGE_SIZES.includes(saved)) setPageSize(saved);
    } catch {
      /* storage blocked */
    }
    setReady(true);
  }, []);

  function changePageSize(n) {
    setPageSize(n);
    setPage(1);
    try {
      localStorage.setItem(PAGE_SIZE_KEY, String(n));
    } catch {
      /* ignore */
    }
  }

  const cacheKey = JSON.stringify([
    config.endpoint,
    config.baseParams || null,
    dq,
    filters,
    page,
    pageSize,
    scope.organizationId,
    scope.branchId,
  ]);
  const reqKey = JSON.stringify([cacheKey, tick]);
  const loading = !ready || state.key !== reqKey;
  const cached = RESPONSE_CACHE.get(cacheKey);
  const view = state.key === reqKey ? state : cached || state;

  useEffect(() => {
    if (!ready) return;
    const ctrl = new AbortController();
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (dq) params.set("q", dq);
    for (const [k, v] of Object.entries({
      ...(config.baseParams || {}),
      ...filters,
    }))
      if (v) params.set(k, v);
    api(`${config.endpoint}?${params}`, { signal: ctrl.signal })
      .then((d) => {
        const next = {
          key: reqKey,
          error: "",
          items: d.items,
          total: d.total,
          pageSize: d.pageSize,
          extra: d,
        };
        if (RESPONSE_CACHE.size > 40)
          RESPONSE_CACHE.delete(RESPONSE_CACHE.keys().next().value);
        RESPONSE_CACHE.set(cacheKey, next);
        setState(next);
      })
      .catch(
        (e) =>
          e.name !== "AbortError" &&
          setState((s) => ({ ...s, key: reqKey, error: e.message })),
      );
    return () => ctrl.abort();
  }, [reqKey, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const { openView, openDoc } = useRecordView();
  const ctx = useMemo(
    () => ({ refresh, toast, confirm, scope, openView, openDoc }),
    [refresh, toast, confirm, scope, openView, openDoc],
  );

  const canEdit = (row) =>
    config.form && !writeBlocked(config, scope)
      ? config.canEditRow
        ? config.canEditRow(row, scope)
        : true
      : false;

  async function remove(row) {
    const ok = await confirm({
      title: `Delete ${config.singular}`,
      message: config.deleteMessage
        ? config.deleteMessage(row)
        : `This ${config.singular.toLowerCase()} will be permanently deleted. This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await api(`${config.endpoint}/${row.id}`, { method: "DELETE" });
      toast.success(res?.message || `${config.singular} deleted.`);
      refresh();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const hasActions =
    config.form || (config.rowActions && config.rowActions.length > 0);
  const headerActions = (
    <>
      <Button variant="secondary" onClick={refresh} aria-label="Refresh" title="Refresh">
        <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
      </Button>
      {config.headerActions?.(ctx)}
      <DataMenu
        config={config}
        scope={scope}
        params={{
          ...(config.baseParams || {}),
          ...(dq ? { q: dq } : {}),
          ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
        }}
        onRestored={refresh}
      />
      {config.form && !writeBlocked(config, scope) && (!config.canCreate || config.canCreate(scope)) && (
        <Button onClick={() => setForm({ mode: "create" })}>
          <Plus size={16} /> {config.createLabel || `Add ${config.singular}`}
        </Button>
      )}
    </>
  );

  return (
    <div>
      <PageHeader
        title={config.title}
        description={config.description}
        actions={headerActions}
      />
      {config.banner?.(scope)}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-1.5 border-b border-slate-100 p-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-56 sm:flex-none">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              autoFocus
              data-search-input="true"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
                setRowIdx(-1);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape" && q) {
                  e.preventDefault();
                  setQ("");
                  setPage(1);
                  setRowIdx(-1);
                } else if (e.key === "ArrowDown" && view.items.length) {
                  e.preventDefault();
                  setRowIdx((r) => Math.min(view.items.length - 1, r + 1));
                } else if (e.key === "ArrowUp" && view.items.length) {
                  e.preventDefault();
                  setRowIdx((r) => Math.max(0, r - 1));
                } else if (e.key === "Enter" && rowIdx >= 0 && view.items[rowIdx]) {
                  e.preventDefault();
                  const row = view.items[rowIdx];
                  const act = (config.rowActions || []).find((a) => (!a.show || a.show(row, scope)) && a.label !== "View")
                    || (config.rowActions || []).find((a) => !a.show || a.show(row, scope));
                  if (act?.href) router.push(act.href(row));
                  else if (act?.onClick) act.onClick(row, ctx);
                }
              }}
              placeholder={config.searchPlaceholder || "Search..."}
              className={`${inputClass} pl-8`}
              aria-label="Search"
            />
          </div>
          {(config.filters || []).map((f) => (
            <Select
              key={f.key}
              value={filters[f.key] || ""}
              onChange={(e) => {
                setFilters((s) => ({ ...s, [f.key]: e.target.value }));
                setPage(1);
              }}
              className="sm:w-40"
              aria-label={f.label}
            >
              <option value="">{f.label}</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          ))}
          {config.dateRange && (
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <input type="date" aria-label="From date" value={filters.from || ""} max={filters.to || undefined} onChange={(e) => { setFilters((s) => ({ ...s, from: e.target.value })); setPage(1); }} className={`${inputClass} w-32`} />
              <span>to</span>
              <input type="date" aria-label="To date" value={filters.to || ""} min={filters.from || undefined} onChange={(e) => { setFilters((s) => ({ ...s, to: e.target.value })); setPage(1); }} className={`${inputClass} w-32`} />
            </div>
          )}
          <PageSizeSelect
            value={pageSize}
            onChange={changePageSize}
            className="sm:ml-auto"
          />
        </div>

        {loading && !view.items.length ? (
          <Spinner />
        ) : !loading && view.error ? (
          <ErrorState message={view.error} onRetry={refresh} />
        ) : (
          <>
            {view.items.length === 0 ? (
              <EmptyState
                title={
                  q || filterKey !== "{}"
                    ? "No matching records"
                    : `No ${config.plural || "records"} yet`
                }
                message={
                  q || filterKey !== "{}"
                    ? "Try different search words or filters."
                    : config.emptyMessage
                }
              />
            ) : (
              <>
                {/* Compact cards replace wide tables on phones and tablets. */}
                <div
                  className={`grid gap-2 p-2 sm:grid-cols-2 lg:grid-cols-3 xl:hidden ${loading ? "opacity-60" : ""}`}
                >
                  {view.items.map((row, idx) => (
                    <article
                      key={row.id}
                      className="min-w-0 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm"
                    >
                      <p className="mb-1 text-[10px] font-bold text-slate-400">
                        #{(page - 1) * pageSize + idx + 1}
                      </p>
                      <dl className="grid min-w-0 grid-cols-1 gap-1.5">
                        {config.columns.map((c, index) => (
                          <div
                            key={c.label}
                            className={`min-w-0 ${index === 0 ? "border-b border-slate-100 pb-2" : ""}`}
                          >
                            <dt className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              {c.label}
                            </dt>
                            <dd className="min-w-0 break-words text-sm text-slate-700">
                              {c.render
                                ? c.render(row, scope)
                                : (row[c.key] ?? "—")}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      {hasActions && (
                        <div className="mt-3 flex flex-wrap items-center justify-end gap-1.5 border-t border-slate-100 pt-2">
                          {(config.rowActions || []).map(
                            (a) =>
                              (!a.show || a.show(row, scope)) &&
                              (a.href ? (
                                <a
                                  key={a.label}
                                  href={a.href(row)}
                                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  {a.icon && <a.icon size={13} />}
                                  {a.label}
                                </a>
                              ) : (
                                <Button
                                  key={a.label}
                                  variant={a.variant || "secondary"}
                                  size="sm"
                                  onClick={() => a.onClick(row, ctx)}
                                >
                                  {a.icon && <a.icon size={13} />}
                                  {a.label}
                                </Button>
                              )),
                          )}
                          {canEdit(row) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setForm({ mode: "edit", row })}
                              aria-label="Edit"
                              title="Edit"
                            >
                              <Pencil size={15} />
                            </Button>
                          )}
                          {config.form && !config.noDelete && canEdit(row) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(row)}
                              aria-label="Delete"
                              title="Delete"
                              className="text-rose-500 hover:bg-rose-50"
                            >
                              <Trash2 size={15} />
                            </Button>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>

                {/* Full table is reserved for wide screens; cells wrap instead of forcing page overflow. */}
                <div
                  className={`hidden min-w-0 xl:block ${loading ? "opacity-60" : ""}`}
                >
                  <table className="w-full table-fixed text-left text-sm">
                    <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="w-10 px-2 py-1.5 text-center">#</th>
                        {config.columns.map((c) => (
                          <th
                            key={c.label}
                            className={`break-words px-2 py-1.5 ${c.className || ""}`}
                          >
                            {c.label}
                          </th>
                        ))}
                        {hasActions && (
                          <th className="w-32 px-2 py-1.5 text-right">
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {view.items.map((row, idx) => (
                        <tr key={row.id} onClick={() => setRowIdx(idx)} className={idx === rowIdx ? "bg-blue-50/80 ring-1 ring-inset ring-blue-400" : "hover:bg-slate-50/60"}>
                          <td className="px-2 py-1 text-center text-xs font-semibold tabular-nums text-slate-400">
                            {(page - 1) * pageSize + idx + 1}
                          </td>
                          {config.columns.map((c) => (
                            <td
                              key={c.label}
                              className={`break-words px-2 py-1 align-middle text-[13px] text-slate-700 ${c.className || ""}`}
                            >
                              {c.render
                                ? c.render(row, scope)
                                : (row[c.key] ?? "—")}
                            </td>
                          ))}
                          {hasActions && (
                            <td className="px-2 py-1">
                              <div className="flex flex-wrap items-center justify-end gap-1">
                                {(config.rowActions || []).map(
                                  (a) =>
                                    (!a.show || a.show(row, scope)) &&
                                    (a.href ? (
                                      <a
                                        key={a.label}
                                        href={a.href(row)}
                                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                      >
                                        {a.icon && <a.icon size={12} />}
                                        {a.label}
                                      </a>
                                    ) : (
                                      <Button
                                        key={a.label}
                                        variant={a.variant || "secondary"}
                                        size="sm"
                                        onClick={() => a.onClick(row, ctx)}
                                      >
                                        {a.icon && <a.icon size={13} />}
                                        {a.label}
                                      </Button>
                                    )),
                                )}
                                {canEdit(row) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                      setForm({ mode: "edit", row })
                                    }
                                    aria-label="Edit"
                                    title="Edit"
                                  >
                                    <Pencil size={15} />
                                  </Button>
                                )}
                                {config.form &&
                                  !config.noDelete &&
                                  canEdit(row) && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => remove(row)}
                                      aria-label="Delete"
                                      title="Delete"
                                      className="text-rose-500 hover:bg-rose-50"
                                    >
                                      <Trash2 size={15} />
                                    </Button>
                                  )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
        <Pagination
          page={page}
          pageSize={pageSize}
          total={view.total}
          onChange={setPage}
        />
      </div>
      {config.footer?.(view.extra)}

      {form && (
        <RecordForm
          config={config}
          scope={scope}
          mode={form.mode}
          row={form.row}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

// Field widths on the 4-column desktop grid: f.span = 1..4 (default by type).
// Compact modal grid: 2 columns (md modal) or 3 columns (lg modal, used by long forms such as tests).
function spanClass(f, cols) {
  const span = f.span || (f.type === "textarea" || f.wide || f.type === "params" ? 4 : f.type === "checkbox" ? 1 : f.mask === "name" || f.type === "email" ? 2 : 1);
  if (span === 1) return "";
  if (cols === 3) return span === 2 ? "sm:col-span-2" : "sm:col-span-3";
  return "sm:col-span-2";
}
const MASK_INPUT_MODE = { phone: "tel", cnic: "numeric" };

// A staff member whose role only has "<module>.view" must not be offered Add / Edit / Delete.
// (The server enforces the same rule; this only hides the buttons.)
function writeBlocked(config, scope) {
  if (!scope.isStaff) return false;
  const mod = config.permissionModule || String(config.endpoint || "").split("/")[2];
  return !(scope.permissions || []).includes(`${mod}.manage`);
}
function applyMask(f, v) {
  if (f.mask === "phone") return cleanPhoneInput(v);
  if (f.mask === "cnic") return cleanCnicInput(v);
  if (f.mask === "name") return cleanPersonName(v);
  return v;
}

function initialValues(config, scope, mode, row) {
  const v = {};
  for (const f of config.form.fields) {
    if (mode === "edit" && row) {
      v[f.name] = f.init
        ? f.init(row)
        : f.type === "date"
          ? row[f.name]
            ? String(row[f.name]).slice(0, 10)
            : ""
          : f.type === "checkbox"
            ? Boolean(row[f.name])
            : (row[f.name] ?? "");
    } else {
      v[f.name] =
        f.default !== undefined
          ? f.default
          : f.type === "checkbox"
            ? false
            : f.type === "params"
              ? []
              : "";
    }
  }
  return v;
}

function RecordForm({ config, scope, mode, row, onClose, onSaved }) {
  const toast = useToast();
  const [values, setValues] = useState(() =>
    initialValues(config, scope, mode, row),
  );
  const branchMode = config.form.branch; // 'required' | 'optional' | undefined
  const showBranch =
    mode === "create" &&
    branchMode &&
    scope.role !== "BRANCH_ADMIN" &&
    (branchMode === "optional" || !scope.branchId);
  const [branchId, setBranchId] = useState(
    branchMode === "optional" ? "" : scope.branchId || "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (name, value) => setValues((s) => ({ ...s, [name]: value }));

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const payload = config.form.toPayload
        ? config.form.toPayload(values)
        : { ...values };
      if (showBranch) payload.branchId = branchId || null;
      await api(
        mode === "create" ? config.endpoint : `${config.endpoint}/${row.id}`,
        { method: mode === "create" ? "POST" : "PATCH", body: payload },
      );
      toast.success(
        `${config.singular} ${mode === "create" ? "created" : "updated"}.`,
      );
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const wide = config.form.fields.some((f) => f.type === "params") || config.form.fields.length > 9;
  const cols = wide ? 3 : 2;
  return (
    <Modal
      open
      size={config.form.size || (wide ? "lg" : "md")}
      title={`${mode === "create" ? "New" : "Edit"} ${config.singular}`}
      onClose={saving ? undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="record-form" loading={saving}>
            {mode === "create" ? "Create" : "Save changes"}
          </Button>
        </>
      }
    >
      <form id="record-form" onSubmit={submit}>
        <FormError message={error} />
        <div className={`grid grid-cols-1 gap-x-3 gap-y-2 ${cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {showBranch && (
            <Field
              label="Branch"
              required={branchMode === "required"}
              className="sm:col-span-2"
              hint={
                branchMode === "optional"
                  ? "Choose “All branches” to share it with every branch of the organization."
                  : undefined
              }
            >
              <Select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                required={branchMode === "required"}
              >
                <option value="">
                  {branchMode === "optional"
                    ? "All branches (organization-wide)"
                    : "Select a branch"}
                </option>
                {scope.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {scope.role === "SUPER_ADMIN" && !scope.organizationId
                      ? `${b.organizationName} — ${b.name}`
                      : b.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {config.form.fields
            .filter(
              (f) =>
                !(mode === "edit" && f.createOnly) &&
                !(mode === "create" && f.editOnly) &&
                (!f.show || f.show(values)),
            )
            .map((f) =>
              f.type === "params" ? (
                <div key={f.name} className={cols === 3 ? "sm:col-span-3" : "sm:col-span-2"}>
                  <ParametersEditor
                    label={f.label}
                    value={values[f.name]}
                    onChange={(v) => set(f.name, v)}
                  />
                </div>
              ) : (
                <Field
                  key={f.name}
                  label={f.label}
                  required={f.required}
                  hint={f.hint}
                  className={spanClass(f, cols)}
                >
                  {f.type === "select" ? (
                    <Select
                      value={values[f.name]}
                      onChange={(e) => set(f.name, e.target.value)}
                      required={f.required}
                    >
                      {!f.required && <option value="">—</option>}
                      {f.required && values[f.name] === "" && (
                        <option value="">Select...</option>
                      )}
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  ) : f.type === "textarea" ? (
                    <textarea
                      value={values[f.name]}
                      onChange={(e) => set(f.name, e.target.value)}
                      rows={2}
                      maxLength={f.maxLength || 500}
                      className={`${inputClass} h-auto py-1.5`}
                    />
                  ) : f.type === "checkbox" ? (
                    <span className="flex h-8 items-center gap-2 text-[13px] text-slate-700">
                      <input
                        type="checkbox"
                        checked={values[f.name]}
                        onChange={(e) => set(f.name, e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300"
                      />{" "}
                      {f.checkboxLabel || "Enabled"}
                    </span>
                  ) : (
                    <input
                      type={f.type || "text"}
                      autoComplete={f.type === "password" ? "new-password" : undefined}
                      value={values[f.name]}
                      onChange={(e) => set(f.name, applyMask(f, e.target.value))}
                      required={f.required}
                      inputMode={MASK_INPUT_MODE[f.mask]}
                      pattern={f.pattern}
                      title={f.patternMessage}
                      step={f.step || (f.type === "number" ? "any" : undefined)}
                      min={f.min}
                      maxLength={f.maxLength || 200}
                      placeholder={f.placeholder}
                      className={inputClass}
                    />
                  )}
                </Field>
              ),
            )}
        </div>
      </form>
    </Modal>
  );
}
