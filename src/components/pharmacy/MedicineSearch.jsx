"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Layers, Plus, Zap } from "lucide-react";
import { api, formatDate, formatMoney } from "@/lib/client";
import { Badge, Spinner, useDebounced } from "@/components/ui";
import VirtualRows from "@/components/virtual-rows";
import SearchBar from "@/components/pos/SearchBar";
import { createScannerDetector } from "@/lib/shortcuts";
import { fetchMedicineCatalog, loadPosCatalog, searchMedicinesLocal } from "@/lib/pos-cache";

export default function MedicineSearch({
  branchId,
  mode = "pos", // "pos" | "purchase"
  disabled = false,
  inputRef: externalRef,
  onSelect, // (medicine, batchOrNull, meta) => void
  onPickBatch, // (medicine) => void
  refreshKey = 0,
  dark = false,
}) {
  const internalRef = useRef(null);
  const searchRef = externalRef || internalRef;
  const scannerRef = useRef(null);
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const dq = useDebounced(q, 140);
  const [categoryId, setCategoryId] = useState("");

  const [catalogState, setCatalogState] = useState({ branchId: "", items: [], syncing: false });
  const [purchaseState, setPurchaseState] = useState({ key: "", items: [] });
  const [hi, setHi] = useState(0);

  const reqKey = `${branchId}|${dq.trim()}|${mode}|${refreshKey}`;

  useEffect(() => {
    if (!branchId || mode !== "pos") return;
    const ctrl = new AbortController();
    loadPosCatalog("medicines", branchId, fetchMedicineCatalog, {
      force: refreshKey > 0,
      signal: ctrl.signal,
      onUpdate: (items, meta) => {
        if (!ctrl.signal.aborted) {
          setCatalogState({ branchId, items, syncing: Boolean(meta?.syncing) });
        }
      },
    });
    return () => ctrl.abort();
  }, [branchId, mode, refreshKey]);

  useEffect(() => {
    if (!branchId || mode === "pos") return;
    const ctrl = new AbortController();
    const params = new URLSearchParams({ branchId, active: "1", pageSize: "80" });
    if (dq.trim()) params.set("q", dq.trim());

    api(`/api/pharmacy/medicines?${params}`, { signal: ctrl.signal })
      .then((d) => {
        setPurchaseState({ key: reqKey, items: d.items || [] });
        setHi(0);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setPurchaseState({ key: reqKey, items: [] });
      });

    return () => ctrl.abort();
  }, [branchId, dq, mode, refreshKey, reqKey]);

  const categories = useMemo(() => {
    if (mode !== "pos" || catalogState.branchId !== branchId) return [];
    const seen = new Map();
    for (const m of catalogState.items) {
      if (m.category?.id && m.category?.name && !seen.has(m.category.id)) {
        seen.set(m.category.id, m.category.name);
      }
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [mode, branchId, catalogState]);

  const quickMeds = useMemo(() => {
    if (mode !== "pos" || catalogState.branchId !== branchId) return [];
    return catalogState.items.filter((m) => (m.validBatches?.length || 0) > 0).slice(0, 6);
  }, [mode, branchId, catalogState]);

  const localItems = useMemo(() => {
    if (mode !== "pos" || !branchId || catalogState.branchId !== branchId) return [];
    return searchMedicinesLocal(catalogState.items, deferredQ, categoryId, 200);
  }, [mode, branchId, catalogState, deferredQ, categoryId]);

  const items = mode === "pos" ? localItems : (branchId ? purchaseState.items : []);
  const loading = mode === "pos"
    ? Boolean(branchId) && catalogState.branchId !== branchId && catalogState.items.length === 0
    : Boolean(branchId) && purchaseState.key !== reqKey;
  const safeHi = items.length ? Math.min(hi, items.length - 1) : 0;

  function choose(med, meta = {}) {
    if (!med) return;
    if (mode === "pos") {
      const validBatches = med.validBatches || [];
      if (validBatches.length === 0) return;
      onSelect(med, validBatches[0], meta);
    } else {
      onSelect(med, null, meta);
    }
    setQ("");
    setHi(0);
    if (meta.isScan || mode !== "pos") {
      setTimeout(() => searchRef.current?.focus(), 0);
    }
  }

  function handleKeyDown(e) {
    if (!scannerRef.current) scannerRef.current = createScannerDetector();
    scannerRef.current.recordKey(e.key);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((i) => Math.min(Math.max(0, items.length - 1), i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      const isScanBurst = scannerRef.current.consumeScanEnter();
      const trimmed = q.trim().toLowerCase();
      const exactBarcode = trimmed
        ? items.find((m) => (m.barcode || "").toLowerCase() === trimmed || (m.sku || "").toLowerCase() === trimmed)
        : null;
      const target = exactBarcode || items[safeHi] || items[0];
      if (target) choose(target, { isScan: isScanBurst || Boolean(exactBarcode) });
    } else if (e.key === "Escape") {
      scannerRef.current.reset();
      if (q) {
        e.preventDefault();
        e.stopPropagation();
        setQ("");
        setHi(0);
      }
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <SearchBar
        inputRef={searchRef}
        value={q}
        disabled={disabled || !branchId}
        syncing={mode === "pos" && catalogState.syncing}
        dark={dark}
        countText={mode === "pos" && items.length > 0 ? `${items.length} matches` : ""}
        ariaLabel="Search medicine"
        onChange={(e) => { setQ(e.target.value); setHi(0); }}
        onKeyDown={handleKeyDown}
        onClear={() => { setQ(""); setHi(0); searchRef.current?.focus(); }}
        placeholder={
          mode === "pos"
            ? "Search medicine, generic, strength, or scan barcode — ↑↓ navigate, Enter adds"
            : "Search medicine, generic, or barcode — Enter adds to purchase"
        }
      />

      {mode === "pos" && categories.length > 0 && (
        <div className="flex shrink-0 items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => { setCategoryId(""); setHi(0); searchRef.current?.focus(); }}
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${
              !categoryId
                ? "bg-blue-600 text-white"
                : dark
                  ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All ({catalogState.items.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              tabIndex={-1}
              onClick={() => { setCategoryId(categoryId === c.id ? "" : c.id); setHi(0); searchRef.current?.focus(); }}
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${
                categoryId === c.id
                  ? "bg-blue-600 text-white"
                  : dark
                    ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {mode === "pos" && !q.trim() && !categoryId && quickMeds.length > 0 && (
        <div className="hidden shrink-0 grid-cols-3 gap-1.5 xl:grid">
          {quickMeds.map((m) => {
            const b = m.validBatches[0];
            return (
              <button
                key={m.id}
                type="button"
                tabIndex={-1}
                onClick={() => choose(m, { isScan: true })}
                className="pos-surface-alt flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1 text-left transition hover:border-blue-500"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1 truncate text-[11.5px] font-semibold">
                    <Zap size={10} className="shrink-0 text-amber-500" />
                    <span className="truncate">{m.name}</span>
                  </p>
                  <p className="truncate text-[10px]" style={{ color: "var(--pos-muted)" }}>
                    {m.strength || m.genericName || "—"} · Stk {Number(m.validStock || 0)}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] font-bold tabular-nums text-emerald-500">
                  {formatMoney(b.salePrice)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div
        className="pos-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border"
      >
        {!branchId ? (
          <p className="p-4 text-center text-xs" style={{ color: "var(--pos-muted)" }}>Select a branch first.</p>
        ) : loading && items.length === 0 ? (
          <div className="p-4"><Spinner /></div>
        ) : items.length === 0 ? (
          <p className="p-4 text-center text-xs" style={{ color: "var(--pos-muted)" }}>No medicines match &ldquo;{q}&rdquo;.</p>
        ) : (
          <>
            <div
              className="pos-surface-alt grid shrink-0 grid-cols-[1fr_5.75rem_4.25rem_4.75rem_3.75rem] border-b px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "var(--pos-muted)" }}
            >
              <span>Medicine / Generic</span>
              <span>{mode === "pos" ? "FEFO Batch" : "Company"}</span>
              <span className="text-right">Stock</span>
              <span className="text-right">{mode === "pos" ? "Price" : "Cost"}</span>
              <span className="text-right">Add</span>
            </div>

            <VirtualRows
              items={items}
              rowHeight={48}
              scrollToIndex={safeHi}
              renderRow={(m, idx) => {
                const validBatches = m.validBatches || [];
                const fefo = validBatches[0];
                const expiredOnly = mode === "pos" && validBatches.length === 0 && (m.expiredBatches?.length || 0) > 0;
                const unavailable = mode === "pos" && validBatches.length === 0;
                const active = idx === safeHi;

                return (
                  <div
                    role="button"
                    tabIndex={-1}
                    data-med-idx={idx}
                    onMouseEnter={() => setHi(idx)}
                    onClick={() => !unavailable && choose(m)}
                    style={{
                      borderColor: "var(--pos-border)",
                      backgroundColor: unavailable
                        ? active ? "rgba(244,63,94,0.12)" : undefined
                        : active ? "var(--pos-row-active)" : undefined,
                    }}
                    className={`grid h-12 grid-cols-[1fr_5.75rem_4.25rem_4.75rem_3.75rem] items-center border-b px-2.5 text-[12px] transition-colors ${
                      unavailable
                        ? "cursor-not-allowed opacity-60"
                        : active
                          ? "cursor-pointer ring-2 ring-inset ring-blue-500"
                          : "cursor-pointer hover:bg-blue-500/5"
                    }`}
                  >
                    <div className="min-w-0 pr-1.5">
                      <div className="flex items-center gap-1 truncate">
                        <span className="truncate font-semibold">{m.name}</span>
                        {m.strength && <span className="shrink-0 text-[10.5px]" style={{ color: "var(--pos-muted)" }}>{m.strength}</span>}
                        {m.dosageForm && (
                          <span
                            className="shrink-0 rounded px-1 text-[9.5px]"
                            style={{ backgroundColor: "var(--pos-chip-bg)", color: "var(--pos-chip-text)" }}
                          >
                            {m.dosageForm}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[10.5px]" style={{ color: "var(--pos-muted)" }}>
                        {m.genericName || "—"}
                        {m.company?.name ? ` · ${m.company.name}` : ""}
                        {m.barcode ? ` · #${m.barcode}` : ""}
                      </p>
                    </div>

                    <div className="min-w-0 pr-1">
                      {mode === "pos" ? (
                        fefo ? (
                          <div>
                            <span className="block truncate font-mono text-[10.5px] font-semibold">{fefo.batchNumber}</span>
                            <span className="block text-[9.5px]" style={{ color: "var(--pos-muted)" }}>{formatDate(fefo.expiryDate)}</span>
                          </div>
                        ) : expiredOnly ? (
                          <Badge tone="red"><AlertTriangle size={10} className="mr-0.5" /> Exp</Badge>
                        ) : (
                          <Badge tone="gray">Out</Badge>
                        )
                      ) : (
                        <span className="block truncate text-[11px]" style={{ color: "var(--pos-muted)" }}>{m.company?.name || "—"}</span>
                      )}
                    </div>

                    <div className="text-right font-semibold tabular-nums">
                      <span className={m.validStock <= 0 ? "text-rose-500" : m.stockStatus === "LOW" ? "text-amber-500" : "text-emerald-500"}>
                        {Number(m.validStock || 0)}
                      </span>
                      <span className="block text-[9.5px] font-normal" style={{ color: "var(--pos-muted)" }}>{m.unit}</span>
                    </div>

                    <div className="text-right font-semibold tabular-nums">
                      {mode === "pos"
                        ? (fefo ? formatMoney(fefo.salePrice) : formatMoney(m.defaultSalePrice))
                        : formatMoney(m.defaultPurchasePrice)}
                    </div>

                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      {mode === "pos" && validBatches.length > 1 && onPickBatch && (
                        <button
                          type="button"
                          onClick={() => onPickBatch(m)}
                          title={`${validBatches.length} batches available`}
                          className="pos-surface-alt inline-flex h-6 items-center gap-0.5 rounded border px-1 text-[10px] font-semibold hover:opacity-80"
                        >
                          <Layers size={10} />{validBatches.length}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={unavailable}
                        onClick={() => choose(m)}
                        aria-label={`Add ${m.name}`}
                        className="inline-flex h-6 w-6 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                );
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
