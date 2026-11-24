"use client";

// Every create / update / delete reports its result as a popup. UIProvider listens
// and drops this one when the calling screen already showed its own message.
function notifyToast(type, message) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("labos:toast", { detail: { type, message } }));
}

/** Small fetch wrapper for client components. Throws Error(message) on failure. */
export async function api(url, { method = "GET", body, signal } = {}) {
  const res = await fetch(url, {
    method,
    cache: "no-store",
    signal,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (res.status === 401) {
    window.location.replace("/login");
    throw new Error("Session expired. Please sign in again.");
  }
  const mutating = method !== "GET";
  if (!res.ok) {
    const message = data?.message || `Request failed (${res.status}).`;
    if (mutating) notifyToast("error", message);
    throw new Error(message);
  }
  if (mutating) {
    const fallback = method === "DELETE" ? "Deleted successfully." : method === "POST" ? "Saved successfully." : "Updated successfully.";
    notifyToast("success", data?.message || fallback);
  }
  return data;
}

export const formatMoney = (n) =>
  `Rs ${Number(n || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;

export const formatDate = (d) =>
  d
    ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Karachi" }).format(new Date(d))
    : "—";

export const formatDateTime = (d) =>
  d
    ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" }).format(new Date(d))
    : "—";

export const toInputDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
