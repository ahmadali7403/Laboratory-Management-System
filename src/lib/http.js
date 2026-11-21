import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isUuid = (value) => typeof value === "string" && UUID_RE.test(value);

// ---- Zod helpers -----------------------------------------------------------
export const uuid = z.string().regex(UUID_RE, "Invalid ID.");
// undefined stays undefined ("not sent"); "" / null become null ("explicitly none").
export const optUuid = z
  .string()
  .nullish()
  .transform((v) => (v === undefined ? undefined : v ? v : null))
  .refine((v) => v === undefined || v === null || UUID_RE.test(v), "Invalid ID.");
export const opt = (max = 300) =>
  z
    .string()
    .trim()
    .max(max, `Maximum ${max} characters allowed.`)
    .nullish()
    .transform((v) => (v == null || v === "" ? null : v));
export const req = (min = 1, max = 200, label = "This field") =>
  z
    .string()
    .trim()
    .min(min, `${label} is required.`)
    .max(max, `${label} must be at most ${max} characters.`);
export const money = z.coerce.number().finite().min(0, "Amount cannot be negative.").max(1_000_000_000);
export const positive = z.coerce.number().finite().gt(0, "Value must be greater than zero.").max(1_000_000_000);
export const optNum = z.preprocess(
  (v) => (v === undefined ? undefined : v === "" || v === null ? null : Number(v)),
  z.number().finite().nullish(),
);
export const optDate = z.preprocess(
  (v) => (v === undefined ? undefined : v === "" || v === null ? null : v),
  z.coerce.date().nullish(),
);

// ---- Responses -------------------------------------------------------------
export function json(data, status = 200) {
  return NextResponse.json(serialize(data), {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function fail(message, status = 400, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function readJson(request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return null;
  }
}

/** Parses JSON + validates with Zod. Returns { data } or { error: Response }. */
export async function parseBody(request, schema) {
  const body = await readJson(request);
  if (body === null) return { error: fail("Request body must be valid JSON.", 400) };
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { error: fail(parsed.error.issues[0]?.message || "Invalid information.", 400) };
  }
  return { data: parsed.data };
}

/** Converts Prisma Decimal -> number so JSON consumers get real numbers. */
export function serialize(value) {
  if (value === null || value === undefined) return value;
  if (Prisma.Decimal.isDecimal(value)) return value.toNumber();
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = serialize(v);
    return out;
  }
  return value;
}

export function paging(searchParams, defaultSize = 15) {
  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("pageSize") || String(defaultSize), 10) || defaultSize));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function handleError(error, label = "API", conflictMessage) {
  if (error instanceof z.ZodError) {
    return fail(error.issues[0]?.message || "Invalid information.", 400);
  }
  const code = error?.code;
  if (code === "P2002") {
    return fail(conflictMessage || "A record with the same unique value already exists.", 409);
  }
  if (code === "P2003") {
    return fail("This record is linked to other records, or a referenced record is invalid.", 409);
  }
  if (code === "P2025") return fail("Record not found.", 404);
  if (code === "P2023") return fail("Invalid ID.", 400);
  console.error(`${label} error:`, error);
  return fail("Something went wrong. Please try again.", 500);
}

/** Money math in whole paisa to avoid floating point drift. */
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
