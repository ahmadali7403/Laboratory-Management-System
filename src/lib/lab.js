import { round2 } from "@/lib/http";

export const SAMPLE_OK = ["COLLECTED", "RECEIVED"];

export function paymentStatusFor(total, paid) {
  const t = round2(total);
  const p = round2(paid);
  if (p <= 0) return "UNPAID";
  if (p + 0.001 >= t) return "PAID";
  return "PARTIAL";
}

/**
 * Re-derives the order workflow status from its samples and results.
 * Call inside the same transaction that changed a sample/result.
 */
export async function recomputeOrderStatus(tx, orderId) {
  const order = await tx.labOrder.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      completedAt: true,
      items: { select: { resultStatus: true } },
      samples: { select: { status: true } },
    },
  });
  if (!order || order.status === "CANCELLED") return order?.status || null;

  const samplesReady = order.samples.length > 0 && order.samples.every((s) => SAMPLE_OK.includes(s.status));
  const allVerified = order.items.length > 0 && order.items.every((i) => i.resultStatus === "VERIFIED");
  const anyResult = order.items.some((i) => i.resultStatus !== "PENDING");

  let status = "REGISTERED";
  if (samplesReady && allVerified) status = "COMPLETED";
  else if (anyResult) status = "IN_PROGRESS";
  else if (samplesReady) status = "SAMPLE_COLLECTED";

  await tx.labOrder.update({
    where: { id: orderId },
    data: {
      status,
      completedAt: status === "COMPLETED" ? order.completedAt || new Date() : null,
    },
  });
  return status;
}

/** Auto flag for numeric results using the test's reference limits. */
const QUALITATIVE = /^(negative|non[- ]?reactive|nil|absent|not seen|not detected|normal)$/i;

export function computeFlag(value, test, fallback = "NORMAL") {
  const text = String(value).trim();
  const n = Number(text.replace(/,/g, ""));
  if (!Number.isFinite(n) || text === "") {
    // Qualitative parameter (e.g. expected "Negative"): anything else is abnormal.
    const expected = test.refRangeText?.trim();
    if (text && expected && QUALITATIVE.test(expected) && text.toLowerCase() !== expected.toLowerCase()) return "ABNORMAL";
    return fallback;
  }
  const low = test.refLow == null ? null : Number(test.refLow);
  const high = test.refHigh == null ? null : Number(test.refHigh);
  if (low == null && high == null) return fallback;
  if (low != null && n < low) return "LOW";
  if (high != null && n > high) return "HIGH";
  return "NORMAL";
}

export function refRangeText(test) {
  if (test.refRangeText) return test.refRangeText;
  const low = test.refLow == null ? null : Number(test.refLow);
  const high = test.refHigh == null ? null : Number(test.refHigh);
  if (low != null && high != null) return `${low} - ${high}`;
  if (low != null) return `≥ ${low}`;
  if (high != null) return `≤ ${high}`;
  return null;
}
