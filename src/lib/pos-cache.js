import { api } from "@/lib/client";

const DB_NAME = "labos-pos-cache-v1";
const STORE_NAME = "catalogs";
const STALE_MS = 30_000;

const memoryCache = new Map(); // key -> { items, syncedAt, cachedAt }

function cacheKey(kind, branchId) {
  return `${kind}:${branchId || "none"}`;
}

function openDb() {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readIdb(key) {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeIdb(key, payload) {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({ key, ...payload });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function fetchMedicineCatalog(branchId) {
  const d = await api(`/api/pharmacy/medicines?catalog=1&branchId=${encodeURIComponent(branchId)}`);
  return d.items || [];
}

export async function fetchTestCatalog(branchId) {
  const url = (page) =>
    `/api/tests?branchId=${encodeURIComponent(branchId)}&active=1&light=1&pageSize=100&page=${page}`;
  const first = await api(url(1));
  const pages = Math.min(30, Math.ceil((first.total || 0) / 100));
  if (pages <= 1) return first.items || [];
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) => api(url(i + 2))),
  );
  return [...(first.items || []), ...rest.flatMap((d) => d.items || [])];
}

/**
 * Returns immediately from memory cache if warm, otherwise hydrates from IndexedDB
 * while running a background network sync so POS never stalls.
 */
export async function loadPosCatalog(kind, branchId, fetcher, { force = false, onUpdate, signal } = {}) {
  if (!branchId) return [];
  const key = cacheKey(kind, branchId);
  const mem = memoryCache.get(key);
  let initial = mem?.items || null;

  if (!initial) {
    const stored = await readIdb(key);
    if (stored?.items?.length) {
      memoryCache.set(key, stored);
      initial = stored.items;
      onUpdate?.(stored.items, { source: "idb", syncing: true });
    }
  } else {
    onUpdate?.(initial, { source: "memory", syncing: force || Date.now() - (mem.cachedAt || 0) > STALE_MS });
  }

  const shouldSync = force || !mem || Date.now() - (mem.cachedAt || 0) > STALE_MS;
  if (shouldSync) {
    try {
      const fresh = await fetcher(branchId);
      if (signal?.aborted) return initial || fresh;
      const entry = { items: fresh, syncedAt: new Date().toISOString(), cachedAt: Date.now() };
      memoryCache.set(key, entry);
      writeIdb(key, entry);
      onUpdate?.(fresh, { source: "network", syncing: false });
      return fresh;
    } catch {
      if (initial) onUpdate?.(initial, { source: "cache-fallback", syncing: false });
      return initial || [];
    }
  }
  return initial || [];
}

/**
 * Optimistically decrements local cached batch stock immediately when a pharmacy sale succeeds
 * so consecutive back-to-back sales stay accurate before background sync finishes.
 */
export function optimisticDecrementMedicineCache(branchId, cartItems = []) {
  if (!branchId || !cartItems.length) return;
  const key = cacheKey("medicines", branchId);
  const cur = memoryCache.get(key);
  if (!cur?.items?.length) return;

  const soldByBatch = new Map();
  for (const line of cartItems) {
    const id = line.batch?.id;
    if (!id) continue;
    soldByBatch.set(id, (soldByBatch.get(id) || 0) + Number(line.qty || 0));
  }
  if (!soldByBatch.size) return;

  const updated = cur.items.map((med) => {
    let touched = false;
    const nextBatches = (med.validBatches || [])
      .map((b) => {
        const sub = soldByBatch.get(b.id);
        if (!sub) return b;
        touched = true;
        return { ...b, quantity: Math.max(0, Math.round((Number(b.quantity) - sub) * 100) / 100) };
      })
      .filter((b) => Number(b.quantity) > 0);
    if (!touched) return med;
    const validStock = nextBatches.reduce((s, b) => s + Number(b.quantity || 0), 0);
    return {
      ...med,
      validBatches: nextBatches,
      batches: nextBatches,
      validStock,
      totalStock: validStock,
    };
  });

  const entry = { ...cur, items: updated };
  memoryCache.set(key, entry);
  writeIdb(key, entry);
}

/** Subsequence fuzzy match (e.g., "pndl" matches "panadol"). */
function fuzzySubseq(needle, hay) {
  let j = 0;
  for (let i = 0; i < hay.length && j < needle.length; i++) {
    if (hay[i] === needle[j]) j++;
  }
  return j === needle.length;
}

export function searchMedicinesLocal(items = [], query = "", categoryId = "", limit = 150) {
  const q = query.trim().toLowerCase();
  const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
  const scored = [];

  for (let i = 0; i < items.length; i++) {
    const m = items[i];
    if (categoryId && m.categoryId !== categoryId && m.category?.id !== categoryId) continue;

    if (!q) {
      scored.push({ m, score: (m.validBatches?.length || 0) > 0 ? 0 : 1000 });
      continue;
    }

    const name = (m.name || "").toLowerCase();
    const generic = (m.genericName || "").toLowerCase();
    const barcode = (m.barcode || "").toLowerCase();
    const sku = (m.sku || "").toLowerCase();
    const strength = (m.strength || "").toLowerCase();
    const form = (m.dosageForm || "").toLowerCase();
    const company = (m.company?.name || "").toLowerCase();
    const batchText = (m.validBatches || []).map((b) => (b.batchNumber || "").toLowerCase()).join(" ");
    const haystack = `${name} ${generic} ${strength} ${form} ${company} ${barcode} ${sku} ${batchText}`;

    let score = -1;
    if (barcode === q || sku === q) score = 0;
    else if (barcode.startsWith(q) || sku.startsWith(q)) score = 1;
    else if (name.startsWith(q)) score = 2;
    else if (generic.startsWith(q)) score = 3;
    else if (tokens.every((t) => haystack.includes(t))) {
      score = name.includes(q) ? 4 : generic.includes(q) ? 5 : 6;
    } else if (q.length >= 3 && (fuzzySubseq(q, name) || fuzzySubseq(q, generic))) {
      score = 8;
    }

    if (score >= 0) {
      // Slightly prefer in-stock items for equal text relevance
      const stockPenalty = (m.validBatches?.length || 0) > 0 ? 0 : 20;
      scored.push({ m, score: score + stockPenalty });
    }
  }

  scored.sort((a, b) => a.score - b.score || a.m.name.localeCompare(b.m.name));
  return scored.slice(0, limit).map((x) => x.m);
}

export function searchTestsLocal(items = [], query = "", category = "", limit = 150) {
  const q = query.trim().toLowerCase();
  const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
  const scored = [];

  for (let i = 0; i < items.length; i++) {
    const t = items[i];
    if (category && t.category !== category) continue;

    if (!q) {
      scored.push({ t, score: 0 });
      continue;
    }

    const code = (t.code || "").toLowerCase();
    const name = (t.name || "").toLowerCase();
    const cat = (t.category || "").toLowerCase();
    const sample = (t.sampleType || "").toLowerCase();
    const haystack = `${code} ${name} ${cat} ${sample}`;

    let score = -1;
    if (code === q) score = 0;
    else if (code.startsWith(q)) score = 1;
    else if (name.startsWith(q)) score = 2;
    else if (tokens.every((tok) => haystack.includes(tok))) {
      score = name.includes(q) ? 3 : 4;
    } else if (q.length >= 3 && fuzzySubseq(q, name)) {
      score = 6;
    }

    if (score >= 0) scored.push({ t, score });
  }

  scored.sort((a, b) => a.score - b.score || a.t.name.localeCompare(b.t.name));
  return scored.slice(0, limit).map((x) => x.t);
}
