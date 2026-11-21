import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SCOPE_COOKIE, apiContext, getScopeOptions } from "@/lib/scope";
import { fail, json, optUuid, parseBody } from "@/lib/http";

export async function GET() {
  const auth = await apiContext(null);
  if (auth.error) return auth.error;
  const options = await getScopeOptions(auth.ctx);
  const { scope } = auth.ctx;
  return json({
    level: scope.level,
    organizationId: scope.organizationId,
    branchId: scope.branchId,
    locked: scope.locked,
    ...options,
  });
}

const schema = z.object({ organizationId: optUuid, branchId: optUuid });

/** Stores the *requested* view. It is re-verified on every later request. */
export async function POST(request) {
  const auth = await apiContext(null);
  if (auth.error) return auth.error;
  const { actor } = auth.ctx;
  if (actor.role === "BRANCH_ADMIN") return fail("Your account is locked to a single branch.", 403);

  const parsed = await parseBody(request, schema);
  if (parsed.error) return parsed.error;
  let { organizationId, branchId } = parsed.data;

  if (actor.role === "ORGANIZATION_ADMIN") organizationId = actor.organizationId;

  if (branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, ...(actor.role === "ORGANIZATION_ADMIN" ? { organizationId: actor.organizationId } : {}) },
      select: { id: true, organizationId: true },
    });
    if (!branch) return fail("Branch not found.", 404);
    if (organizationId && branch.organizationId !== organizationId) return fail("Branch does not belong to the selected organization.", 400);
    organizationId = branch.organizationId;
  } else if (organizationId && actor.role === "SUPER_ADMIN") {
    const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
    if (!org) return fail("Organization not found.", 404);
  }

  const res = NextResponse.json({ success: true, organizationId: organizationId || null, branchId: branchId || null });
  res.cookies.set(SCOPE_COOKIE, JSON.stringify({ o: organizationId || null, b: branchId || null }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
