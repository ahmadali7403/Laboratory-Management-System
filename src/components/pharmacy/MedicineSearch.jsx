"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Layers, Plus, Search } from "lucide-react";
import { api, formatDate, formatMoney } from "@/lib/client";
import { Badge, Spinner, useDebounced } from "@/components/ui";

const ic = "h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-[13px] text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100";

export default function MedicineSearch({
  branchId,
  mode = "pos", // "pos" | "purchase"
  disabled = false,
  inputRef: externalRef,
  onSelect, // (medicine, batchOrNull) => void
  onPickBatch, // (medicine) => void (when user wants to pick from multiple batches)
  refreshKey = 0,
}) {
  const internalRef = useRef(null);
  const searchRef = externalRef || internalRef;
  const listRef = useRef(null);
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 140);
  const [state, setState] = useState({ key: "", items: [] });
  const [hi, setHi] = useState(0);
  const reqKey = `${branchId}|${dq.trim()}|${mode}|${refreshKey}`;
  const loading = Boolean(branchId) && state.key !== reqKey;
  const items = branchId ? state.items : [];

  useEffect(() => {
    if (!branchId) return;
    const ctrl = new AbortController();
    const params = new URLSearchParams({ branchId });
    if (mode === "pos") params.set("pos", "1");
    else {
      params.set("active", "1");
      params.set("pageSize", "80");
    }
    if (dq.trim()) params.set("q", dq.trim());

    api(`/api/pharmacy/medicines?${params}`, { signal: ctrl.signal })
      .then((d) => {
        setState({ key: reqKey, items: d.items || [] });
        setHi(0);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setState({ key: reqKey, items: [] });
      });

    return () => ctrl.abort();
  }, [branchId, dq, mode, refreshKey, reqKey]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-med-idx="${hi}"]`)?.scrollIntoView({ block: "nearest" });
  }, [hi, items.length]);

  function choose(med) {
    if (!med) return;
    if (mode === "pos") {
      const validBatches = med.validBatches || [];
      if (validBatches.length === 0) return;
      onSelect(med, validBatches[0]); // FEFO: earliest non-expired batch with stock
    } else {
      onSelect(med, null);
    }
    setQ("");
    setHi(0);
    setTimeout(() => searchRef.current?.focus(), 0);
  }

  function handleKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((i) => Math.min(Math.max(0, items.length - 1), i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      const target = items[hi] || items[0];
      if (target) choose(target);
    } else if (e.key === "Escape") {
      if (q) {
        e.preventDefault();
        e.stopPropagation();
        setQ("");
        setHi(0);
      }
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative shrink-0">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400" />
        <input
          ref={searchRef}
          autoFocus
          value={q}
          disabled={disabled || !branchId}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            mode === "pos"
              ? "Search medicine, generic, or scan barcode — ↑↓ navigate, Enter adds FEFO batch"
              : "Search medicine, generic, or barcode — Enter adds to purchase"
          }
          aria-label="Search medicine"
          className={`${ic} pl-8 pr-16`}
        />
        {q && (
          <button
            type="button"
            onClick={() => { setQ(""); setHi(0); searchRef.current?.focus(); }}
            className="absolute right-2 top-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-100"
          >
            Esc
          </button>
        )}
      </div>

      <div ref={listRef} className="mt-1.5 min-h-0 flex-1 overflow-y-auto rounded-md border border-slate-200 bg-white">
        {!branchId ? (
          <p className="p-4 text-center text-xs text-slate-400">Select a branch first.</p>
        ) : loading && items.length === 0 ? (
          <div className="p-4"><Spinner /></div>
        ) : items.length === 0 ? (
          <p className="p-4 text-center text-xs text-slate-400">No medicines match &ldquo;{q}&rdquo;.</p>
        ) : (
          <table className="w-full text-left text-[12.5px]">
            <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 shadow-[0_1px_0_#e2e8f0]">
              <tr>
                <th className="px-2 py-1.5">Medicine / Generic</th>
                {mode === "pos" ? (
                  <>
                    <th className="w-24 px-2 py-1.5">FEFO Batch</th>
                    <th className="w-20 px-2 py-1.5 text-right">Stock</th>
                    <th className="w-20 px-2 py-1.5 text-right">Price</th>
                  </>
                ) : (
                  <>
                    <th className="w-24 px-2 py-1.5">Company</th>
                    <th className="w-20 px-2 py-1.5 text-right">Stock</th>
                    <th className="w-20 px-2 py-1.5 text-right">Cost</th>
                  </>
                )}
                <th className="w-16 px-1.5 py-1.5 text-right">Add</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((m, idx) => {
                const validBatches = m.validBatches || [];
                const fefo = validBatches[0];
                const expiredOnly = mode === "pos" && validBatches.length === 0 && (m.expiredBatches?.length || 0) > 0;
                const unavailable = mode === "pos" && validBatches.length === 0;
                const active = idx === hi;

                return (
                  <tr
                    key={m.id}
                    data-med-idx={idx}
                    onMouseEnter={() => setHi(idx)}
                    onClick={() => !unavailable && choose(m)}
                    className={`transition-colors ${
                      unavailable
                        ? active
                          ? "cursor-not-allowed bg-rose-50/80 ring-1 ring-inset ring-rose-300"
                          : "cursor-not-allowed bg-slate-50/60 opacity-70"
                        : active
                          ? "cursor-pointer bg-blue-100/90 ring-2 ring-inset ring-blue-500"
                          : "cursor-pointer hover:bg-blue-50/60"
                    }`}
                  >
                    <td className="px-2 py-1.5 align-top">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="font-semibold text-slate-900">{m.name}</span>
                        {m.strength && <span className="text-[11px] font-medium text-slate-600">{m.strength}</span>}
                        {m.dosageForm && <span className="rounded bg-slate-100 px-1 text-[10px] text-slate-500">{m.dosageForm}</span>}
                      </div>
                      <p className="truncate text-[11px] text-slate-500">
                        {m.genericName || "—"}
                        {m.company?.name ? ` · ${m.company.name}` : ""}
                        {m.barcode ? ` · #${m.barcode}` : ""}
                      </p>
                    </td>
                    {mode === "pos" ? (
                      <>
                        <td className="px-2 py-1.5 align-top">
                          {fefo ? (
                            <div>
                              <span className="font-mono text-[11px] font-semibold text-slate-700">{fefo.batchNumber}</span>
                              <span className="block text-[10px] text-slate-500">{formatDate(fefo.expiryDate)}</span>
                            </div>
                          ) : expiredOnly ? (
                            <Badge tone="red"><AlertTriangle size={10} className="mr-0.5" /> Expired</Badge>
                          ) : (
                            <Badge tone="gray">No stock</Badge>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right align-top font-semibold tabular-nums">
                          <span className={m.validStock <= 0 ? "text-rose-600" : m.stockStatus === "LOW" ? "text-amber-600" : "text-emerald-700"}>
                            {Number(m.validStock || 0)}
                          </span>
                          <span className="block text-[10px] font-normal text-slate-400">{m.unit}</span>
                        </td>
                        <td className="px-2 py-1.5 text-right align-top font-semibold tabular-nums text-slate-800">
                          {fefo ? formatMoney(fefo.salePrice) : formatMoney(m.defaultSalePrice)}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-2 py-1.5 align-top text-[11px] text-slate-500">{m.company?.name || "—"}</td>
                        <td className="px-2 py-1.5 text-right align-top font-semibold tabular-nums text-slate-700">
                          {Number(m.validStock || 0)} <span className="text-[10px] font-normal text-slate-400">{m.unit}</span>
                        </td>
                        <td className="px-2 py-1.5 text-right align-top font-semibold tabular-nums text-slate-800">
                          {formatMoney(m.defaultPurchasePrice)}
                        </td>
                      </>
                    )}
                    <td className="px-1.5 py-1.5 text-right align-top" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1">
                        {mode === "pos" && validBatches.length > 1 && onPickBatch && (
                          <button
                            type="button"
                            onClick={() => onPickBatch(m)}
                            title={`${validBatches.length} batches available`}
                            className="inline-flex h-6 items-center gap-0.5 rounded border border-slate-200 bg-white px-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            <Layers size={11} /> {validBatches.length}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={unavailable}
                          onClick={() => choose(m)}
                          aria-label={`Add ${m.name}`}
                          className="inline-flex h-6 w-6 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
