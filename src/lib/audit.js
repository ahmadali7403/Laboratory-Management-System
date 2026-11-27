import { prisma } from "@/lib/prisma";

export function clientIp(request) {
  try {
    const fwd = request?.headers?.get?.("x-forwarded-for") || "";
    const real = request?.headers?.get?.("x-real-ip") || "";
    return (fwd.split(",")[0] || real || "").trim().slice(0, 80) || null;
  } catch {
    return null;
  }
}

/**
 * Writes an audit event without letting audit logging failure break a business request
 * unless tx (transactional) is passed explicitly.
 */
export async function logAudit(
  {
    tx = null,
    organizationId = null,
    branchId = null,
    userId = null,
    actorName = "System",
    actorRole = "SYSTEM",
    action,
    resource,
    resourceId = null,
    summary,
    meta = undefined,
    ip = null,
  },
) {
  const payload = {
    organizationId,
    branchId,
    userId,
    actorName,
    actorRole,
    action,
    resource,
    resourceId: resourceId ? String(resourceId) : null,
    summary: String(summary || action).slice(0, 400),
    meta: meta === undefined ? undefined : meta,
    ip,
  };
  if (tx) {
    return tx.auditLog.create({ data: payload });
  }
  try {
    return await prisma.auditLog.create({ data: payload });
  } catch (err) {
    console.error("Audit log failed:", err?.message || err);
    return null;
  }
}
