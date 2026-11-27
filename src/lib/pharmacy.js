import { dayKey } from "@/lib/time";
import { round2 } from "@/lib/http";

export const PHARMACY_PAYMENT_METHODS = [
  ["CASH", "Cash"],
  ["CARD", "Card"],
  ["BANK_TRANSFER", "Bank Transfer"],
  ["JAZZCASH", "JazzCash"],
  ["EASYPAISA", "EasyPaisa"],
  ["ONLINE", "Online"],
];

export const PHARMACY_METHOD_VALUES = PHARMACY_PAYMENT_METHODS.map(([v]) => v);

export const PHARMACY_REPORT_TYPES = [
  { key: "sales", label: "Pharmacy Sales Report" },
  { key: "purchases", label: "Pharmacy Purchases Report" },
  { key: "stock", label: "Stock Valuation Report" },
  { key: "low_stock", label: "Low & Out of Stock Report" },
  { key: "expiry", label: "Expiry & Near-Expiry Report" },
  { key: "profit", label: "Sales Margin & Profit Report" },
  { key: "suppliers", label: "Supplier Balances & Ledger" },
  { key: "movements", label: "Stock Movement Ledger" },
  { key: "price_audits", label: "Price Change Audit" },
];

export const DOSAGE_FORMS = [
  "Tablet",
  "Capsule",
  "Syrup",
  "Suspension",
  "Injection",
  "Drops",
  "Cream",
  "Ointment",
  "Gel",
  "Inhaler",
  "Powder",
  "Sachet",
  "Suppository",
  "Spray",
  "IV Fluid",
  "Consumable",
  "Other",
];

/** Calendar day UTC midnight matching Asia/Karachi today (aligns with @db.Date columns). */
export function todayUtcDate(now = new Date()) {
  return new Date(`${dayKey(now)}T00:00:00.000Z`);
}

export function daysFromTodayUtc(days, now = new Date()) {
  const base = todayUtcDate(now);
  return new Date(base.getTime() + days * 86_400_000);
}

export function isBatchExpired(expiryDate, now = new Date()) {
  if (!expiryDate) return false;
  return new Date(expiryDate) < todayUtcDate(now);
}

export function expiryStatusOf(expiryDate, nearDays = 30, now = new Date()) {
  if (!expiryDate) return "UNKNOWN";
  const exp = new Date(expiryDate);
  const today = todayUtcDate(now);
  if (exp < today) return "EXPIRED";
  const near = daysFromTodayUtc(nearDays, now);
  if (exp <= near) return "NEAR_EXPIRY";
  const soon = daysFromTodayUtc(90, now);
  if (exp <= soon) return "EXPIRING_90";
  return "VALID";
}

export function stockStatusOf(stock, alertLevel) {
  const qty = Number(stock || 0);
  const alert = Number(alertLevel || 0);
  if (qty <= 0) return "OUT";
  if (alert > 0 && qty <= alert) return "LOW";
  return "NORMAL";
}

/** Records a traceable stock movement inside a Prisma transaction. */
export async function recordStockMovement(
  tx,
  {
    organizationId,
    branchId,
    medicineId,
    batchId,
    type,
    quantityChange,
    balanceBefore,
    balanceAfter,
    referenceType = null,
    referenceId = null,
    referenceNo = null,
    reason = null,
    createdByName,
  },
) {
  return tx.pharmacyStockMovement.create({
    data: {
      organizationId,
      branchId,
      medicineId,
      batchId,
      type,
      quantityChange: round2(quantityChange),
      balanceBefore: round2(balanceBefore),
      balanceAfter: round2(balanceAfter),
      referenceType,
      referenceId,
      referenceNo,
      reason,
      createdByName,
    },
  });
}

/** Summarizes batch-level stock onto each Medicine record (FEFO ordered). */
export function enrichMedicine(med, now = new Date()) {
  const today = todayUtcDate(now);
  const near30 = daysFromTodayUtc(30, now);
  const batches = (med.batches || []).slice().sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
  let totalStock = 0;
  let validStock = 0;
  let expiredStock = 0;
  let nearExpiryStock = 0;
  let stockValue = 0;
  let nearestExpiry = null;

  for (const b of batches) {
    if (!b.isActive) continue;
    const qty = Number(b.quantity || 0);
    if (qty <= 0) continue;
    totalStock += qty;
    stockValue += qty * Number(b.purchasePrice || 0);
    const exp = new Date(b.expiryDate);
    if (exp < today) {
      expiredStock += qty;
    } else {
      validStock += qty;
      if (!nearestExpiry || exp < nearestExpiry) nearestExpiry = exp;
      if (exp <= near30) nearExpiryStock += qty;
    }
  }

  return {
    ...med,
    totalStock: round2(totalStock),
    validStock: round2(validStock),
    expiredStock: round2(expiredStock),
    nearExpiryStock: round2(nearExpiryStock),
    stockValue: round2(stockValue),
    nearestExpiry,
    stockStatus: stockStatusOf(validStock, med.lowStockAlert),
    expiryStatus: expiredStock > 0 && validStock <= 0 ? "EXPIRED" : nearExpiryStock > 0 ? "NEAR_EXPIRY" : nearestExpiry ? "VALID" : "NONE",
  };
}
