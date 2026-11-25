"use client";

// Every create / update / delete reports its result as a popup. UIProvider listens
// and drops this one when the calling screen already showed its own message.
function notifyToast(type, message) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("labos:toast", { detail: { type, message } }));
}

// A 401 can be a one-off (cookie rotated by another tab, a request racing a refresh).
// Before signing the person out we ask the server once whether the session is still valid;
// concurrent requests share that single check. Only a definite 401 from /api/auth/refresh logs out.
let refreshing = null;
function sessionStillValid() {
  if (!refreshing) {
    refreshing = fetch("/api/auth/refresh", { method: "POST", cache: "no-store" })
      .then((r) => r.status !== 401)
      .catch(() => true) // network trouble is not a logout
      .finally(() => setTimeout(() => { refreshing = null; }, 2000));
  }
  return refreshing;
}

/** Small fetch wrapper for client components. Throws Error(message) on failure. */
export async function api(url, { method = "GET", body, signal } = {}) {
  const send = () => fetch(url, {
    method,
    cache: "no-store",
    signal,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let res = await send();
  if (res.status === 401 && (await sessionStillValid())) res = await send();
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
