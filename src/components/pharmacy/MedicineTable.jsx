"use client";

import { useCallback, useEffect, useState } from "react";
import { Layers, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { api, formatDate, formatMoney } from "@/lib/client";
import { hasModule } from "@/lib/permissions";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Select,
  Spinner,
  StatusBadge,
  inputClass,
  useConfirm,
  useDebounced,
  useToast,
} from "@/components/ui";
import MedicineForm from "@/components/pharmacy/MedicineForm";
import BatchManagerModal from "@/components/pharmacy/BatchManagerModal";

export default function MedicineTable({ scope }) {
  const toast = useToast();
  const confirm = useConfirm();
  const canManage = !scope.isStaff || hasModule(scope.permissions || [], "pharmacy_inventory", true);
  const canSuppliers = !scope.isStaff || hasModule(scope.permissions || [], "pharmacy_suppliers") || canManage;

  const [q, setQ] = useState("");
  const dq = useDebounced(q, 250);
  const [categoryId, setCategoryId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [stock, setStock] = useState("");
  const [page, setPage] = useState(1);

  const [categories, setCategories] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [tick, setTick] = useState(0);
  const [state, setState] = useState({ key: "", error: "", items: [], total: 0, pageSize: 20 });
  const reqKey = `${dq.trim()}|${categoryId}|${companyId}|${supplierId}|${stock}|${page}|${scope.organizationId || ""}|${scope.branchId || ""}|${tick}`;
  const loading = state.key !== reqKey;
  const data = state;
  const error = state.error;
  const [formMed, setFormMed] = useState(null); // null | {} | medicine
  const [batchMedId, setBatchMedId] = useState(null);

  useEffect(() => {
    api("/api/pharmacy/categories?active=1&pageSize=100").then((d) => setCategories(d.items || [])).catch(() => {});
    api("/api/pharmacy/companies?active=1&pageSize=100").then((d) => setCompanies(d.items || [])).catch(() => {});
    if (canSuppliers) {
      api("/api/pharmacy/suppliers?options=1").then((d) => setSuppliers(d.items || [])).catch(() => {});
    }
  }, [scope.organizationId, canSuppliers]);

  const load = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    const sp = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (dq.trim()) sp.set("q", dq.trim());
    if (categoryId) sp.set("categoryId", categoryId);
    if (companyId) sp.set("companyId", companyId);
    if (supplierId) sp.set("supplierId", supplierId);
    if (stock) sp.set("stock", stock);
    api(`/api/pharmacy/medicines?${sp}`, { signal: ctrl.signal })
      .then((d) => setState({ key: reqKey, error: "", ...d }))
      .catch((e) => {
        if (e.name !== "AbortError") setState((s) => ({ ...s, key: reqKey, error: e.message }));
      });
    return () => ctrl.abort();
  }, [dq, categoryId, companyId, supplierId, stock, page, reqKey]);

  async function remove(med) {
    const ok = await confirm({
      title: "Delete Medicine",
      message: `Delete "${med.name}"? Medicines with batches or transactions will be marked inactive instead.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      const r = await api(`/api/pharmacy/medicines/${med.id}`, { method: "DELETE" });
      toast.success(r.message);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-2">
      <PageHeader
        title="Medicine Inventory"
        description="Manage medicines, batches, pricing, stock alerts, and expiry status."
        actions={
          <>
            <Button variant="secondary" onClick={load} aria-label="Refresh">
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </Button>
            {canManage && (
              <Button onClick={() => setFormMed({})}>
                <Plus size={15} /> Add Medicine
              </Button>
            )}
          </>
        }
      />

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 p-2">
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Search name, generic, barcode, batch..."
              className={`${inputClass} pl-8`}
            />
          </div>
          <Select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} className="sm:w-40">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={companyId} onChange={(e) => { setCompanyId(e.target.value); setPage(1); }} className="sm:w-40">
            <option value="">All companies</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          {suppliers.length > 0 && (
            <Select value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setPage(1); }} className="sm:w-40">
              <option value="">All suppliers</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          )}
          <Select value={stock} onChange={(e) => { setStock(e.target.value); setPage(1); }} searchable={false} className="sm:w-36">
            <option value="">All stock</option>
            <option value="ALERT">Low + Out</option>
            <option value="LOW">Low stock</option>
            <option value="OUT">Out of stock</option>
            <option value="NORMAL">Normal</option>
          </Select>
        </div>

        {loading && !data.items.length ? (
          <Spinner />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : data.items.length === 0 ? (
          <EmptyState title="No medicines found" message="Add a medicine or adjust your search filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-[12.5px]">
              <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-2.5 py-2">Medicine / Generic</th>
                  <th className="px-2.5 py-2">Category / Company</th>
                  <th className="px-2.5 py-2">Batches</th>
                  <th className="px-2.5 py-2 text-right">Valid Stock</th>
                  <th className="px-2.5 py-2 text-right">Default Cost / Sale</th>
                  <th className="px-2.5 py-2">Nearest Expiry</th>
                  <th className="px-2.5 py-2">Status</th>
                  <th className="w-36 px-2.5 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((m) => (
                  <tr
                    key={m.id}
                    className={m.stockStatus === "OUT" ? "bg-rose-50/30" : m.stockStatus === "LOW" ? "bg-amber-50/30" : "hover:bg-slate-50/60"}
                  >
                    <td className="px-2.5 py-1.5">
                      <p className="font-semibold text-slate-900">
                        {m.name} {m.strength && <span className="font-normal text-slate-500">{m.strength}</span>}
                        {m.dosageForm && <span className="ml-1.5 rounded bg-slate-100 px-1 py-px text-[10px] font-medium text-slate-600">{m.dosageForm}</span>}
                      </p>
                      <p className="text-[11px] text-slate-500">{m.genericName || "—"}{m.barcode ? ` · #${m.barcode}` : ""}</p>
                    </td>
                    <td className="px-2.5 py-1.5 text-xs text-slate-600">
                      <p>{m.category?.name || "—"}</p>
                      <p className="text-[11px] text-slate-400">{m.company?.name || "—"}</p>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <button
                        type="button"
                        onClick={() => setBatchMedId(m.id)}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        <Layers size={12} /> {(m.batches || []).filter((b) => Number(b.quantity) > 0).length} active
                      </button>
                    </td>
                    <td className="px-2.5 py-1.5 text-right">
                      <span className={`font-bold tabular-nums ${m.stockStatus === "OUT" ? "text-rose-600" : m.stockStatus === "LOW" ? "text-amber-600" : "text-slate-900"}`}>
                        {Number(m.validStock)} {m.unit}
                      </span>
                      {m.expiredStock > 0 && <span className="block text-[10px] font-semibold text-rose-600">+{m.expiredStock} expired</span>}
                    </td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums">
                      <span className="text-slate-500">{formatMoney(m.defaultPurchasePrice)}</span>
                      <span className="block font-semibold text-slate-800">{formatMoney(m.defaultSalePrice)}</span>
                    </td>
                    <td className="px-2.5 py-1.5 text-xs">
                      {m.nearestExpiry ? (
                        <span className={m.expiryStatus === "NEAR_EXPIRY" ? "font-semibold text-amber-700" : "text-slate-700"}>
                          {formatDate(m.nearestExpiry)}
                          {m.expiryStatus === "NEAR_EXPIRY" && <Badge tone="amber" className="ml-1">Soon</Badge>}
                        </span>
                      ) : m.expiredStock > 0 ? (
                        <Badge tone="red">Expired only</Badge>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-2.5 py-1.5">
                      <div className="flex flex-col items-start gap-0.5">
                        <StatusBadge value={m.status} />
                        {m.stockStatus !== "NORMAL" && <Badge tone={m.stockStatus === "OUT" ? "red" : "amber"}>{m.stockStatus} STOCK</Badge>}
                      </div>
                    </td>
                    <td className="px-2.5 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="secondary" size="sm" onClick={() => setBatchMedId(m.id)}>Batches</Button>
                        {canManage && (
                          <>
                            <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setFormMed(m)}><Pencil size={14} /></Button>
                            <Button variant="ghost" size="icon" aria-label="Delete" className="text-rose-500" onClick={() => remove(m)}><Trash2 size={14} /></Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={data.pageSize || 20} total={data.total || 0} onChange={setPage} />
      </div>

      {formMed !== null && (
        <MedicineForm
          scope={scope}
          medicine={formMed.id ? formMed : null}
          categories={categories}
          companies={companies}
          suppliers={suppliers}
          onClose={() => setFormMed(null)}
          onSaved={() => { setFormMed(null); load(); }}
        />
      )}

      {batchMedId && (
        <BatchManagerModal
          medicineId={batchMedId}
          canManage={canManage}
          suppliers={suppliers}
          onClose={() => setBatchMedId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
