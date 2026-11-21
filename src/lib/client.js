"use client";

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
  if (!res.ok) throw new Error(data?.message || `Request failed (${res.status}).`);
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
