import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiContext } from "@/lib/scope";
import { fail, json, parseBody } from "@/lib/http";
import { checkRateLimit, clearRateLimit, recordRateFailure } from "@/lib/rate-limit";
import { clientIp, logAudit } from "@/lib/audit";

const schema = z.object({
  secret: z.string().min(1, "Enter your password or PIN.").max(100),
});

export async function POST(request) {
  const auth = await apiContext(request);
  if (auth.error) return auth.error;
  const actor = auth.ctx.actor;
  const parsed = await parseBody(request, schema);
  if (parsed.error) return parsed.error;

  const limitKey = `unlock:${actor.id}`;
  const gate = checkRateLimit(limitKey, { maxAttempts: 8, windowMs: 10 * 60_000 });
  if (!gate.allowed) {
    return fail(`Too many unlock attempts. Try again in ${Math.ceil(gate.retryAfterSec / 60)}m.`, 429);
  }

  const secret = parsed.data.secret.trim();
  let ok = false;

  if (actor.role === "SUPER_ADMIN") {
    const admin = await prisma.platformAdmin.findUnique({ where: { id: actor.id }, select: { password: true } });
    if (admin) ok = await bcrypt.compare(secret, admin.password);
  } else {
    const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { password: true, pinHash: true } });
    if (user) {
      if (/^\d{4,6}$/.test(secret) && user.pinHash) {
        ok = await bcrypt.compare(secret, user.pinHash);
      }
      if (!ok) {
        ok = await bcrypt.compare(secret, user.password);
      }
    }
  }

  if (!ok) {
    recordRateFailure(limitKey);
    return NextResponse.json({ message: "Incorrect password or PIN." }, { status: 401 });
  }

  clearRateLimit(limitKey);
  await logAudit({
    organizationId: actor.organizationId,
    branchId: actor.branchId,
    userId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "SCREEN_UNLOCK",
    resource: "AUTH",
    summary: `${actor.name} unlocked session screen`,
    ip: clientIp(request),
  });
  return json({ ok: true });
}
