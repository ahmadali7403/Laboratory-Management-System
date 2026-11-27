import { z } from "zod";

// Shared by API routes (server) and forms (client). No server-only imports here.

/** Letters from any language, combining marks, spaces, hyphen, apostrophe, dot. No digits. */
export const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]*$/u;
export const NAME_MESSAGE = "Name may contain letters, spaces, hyphens and apostrophes only (no numbers).";

export const cleanPersonName = (v) => String(v ?? "").replace(/[^\p{L}\p{M}\s.'’-]/gu, "").replace(/\s{2,}/g, " ");

/** Pakistani mobile: 03XXXXXXXXX (11 digits). International numbers: +<7-15 digits>. */
export function normalizePhone(raw) {
  const v = String(raw ?? "").trim().replace(/[\s()-]/g, "");
  if (!v) return null;
  if (v.startsWith("+")) return /^\+[1-9]\d{6,14}$/.test(v) ? v : undefined;
  if (/^03\d{9}$/.test(v)) return v;
  if (/^923\d{9}$/.test(v)) return `0${v.slice(2)}`;
  if (/^0\d{9,10}$/.test(v)) return v; // landline with area code
  return undefined;
}
export const PHONE_MESSAGE = "Enter a valid phone: 11-digit mobile (03XXXXXXXXX) or international number starting with +.";
export const cleanPhoneInput = (v) => {
  const s = String(v ?? "");
  const plus = s.trim().startsWith("+");
  const digits = s.replace(/\D/g, "").slice(0, plus ? 15 : 11);
  return plus ? `+${digits}` : digits;
};

/** CNIC is stored as 13 digits with dashes: 12345-1234567-1. */
export function normalizeCnic(raw) {
  const d = String(raw ?? "").replace(/[\s-]/g, "");
  if (!d) return null;
  if (!/^\d{13}$/.test(d)) return undefined;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
}
export const CNIC_MESSAGE = "CNIC must be 13 digits (e.g. 35202-1234567-1).";
export const cleanCnicInput = (v) => {
  const d = String(v ?? "").replace(/\D/g, "").slice(0, 13);
  if (d.length <= 5) return d;
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
};

export const personName = (label = "Name", max = 120) =>
  z.string().trim().min(2, `${label} is required (at least 2 letters).`).max(max, `${label} must be at most ${max} characters.`).regex(NAME_RE, NAME_MESSAGE);

export const optPersonName = (max = 120) =>
  z.string().trim().max(max).nullish().transform((v) => (v == null || v === "" ? null : v)).refine((v) => v === null || NAME_RE.test(v), NAME_MESSAGE);

export const phoneField = z.string().trim().max(30).nullish().transform((v, ctx) => {
  if (v == null || v === "") return null;
  const n = normalizePhone(v);
  if (n === undefined) { ctx.addIssue({ code: "custom", message: PHONE_MESSAGE }); return z.NEVER; }
  return n;
});

export const cnicField = z.string().trim().max(20).nullish().transform((v, ctx) => {
  if (v == null || v === "") return null;
  const n = normalizeCnic(v);
  if (n === undefined) { ctx.addIssue({ code: "custom", message: CNIC_MESSAGE }); return z.NEVER; }
  return n;
});

/** Login username: 3-30 chars, lowercase letters, digits, dot, underscore, hyphen. */
export const usernameField = z.string().trim().toLowerCase()
  .min(3, "Username must be at least 3 characters.").max(30, "Username must be at most 30 characters.")
  .regex(/^[a-z0-9._-]+$/, "Username may contain letters, numbers, dot, underscore and hyphen only.");

export const passwordField = z.string().min(6, "Password must be at least 6 characters.").max(100, "Password is too long.");
