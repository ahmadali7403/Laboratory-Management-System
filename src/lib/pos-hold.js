/**
 * Local Hold / Resume bill storage & Undo history utilities for POS screens.
 */

const PREFIX = "labos:pos:hold:";

export function loadHeldBills(channel, branchId) {
  if (typeof window === "undefined" || !branchId) return [];
  try {
    const raw = localStorage.getItem(`${PREFIX}${channel}:${branchId}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHeldBills(channel, branchId, bills) {
  if (typeof window === "undefined" || !branchId) return;
  try {
    localStorage.setItem(`${PREFIX}${channel}:${branchId}`, JSON.stringify(bills.slice(0, 20)));
  } catch {
    /* ignore quota errors */
  }
}

export function holdBill(channel, branchId, snapshot) {
  const bills = loadHeldBills(channel, branchId);
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    heldAt: new Date().toISOString(),
    ...snapshot,
  };
  const next = [entry, ...bills];
  saveHeldBills(channel, branchId, next);
  return next;
}

export function removeHeldBill(channel, branchId, id) {
  const next = loadHeldBills(channel, branchId).filter((b) => b.id !== id);
  saveHeldBills(channel, branchId, next);
  return next;
}
