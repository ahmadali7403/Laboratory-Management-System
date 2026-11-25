import { prisma } from "@/lib/prisma";
import { apiContext, resolveOrganizationTarget } from "@/lib/scope";
import { handleError, json } from "@/lib/http";
import { seedDefaultTests } from "@/lib/test-defaults";
import { memoDelete } from "@/lib/memo";

/** Adds CBC / LFT / RFT / Electrolytes to the organization catalog (idempotent). */
export async function POST(request) {
  try {
    const auth = await apiContext(request, { roles: ["SUPER_ADMIN", "ORGANIZATION_ADMIN"] });
    if (auth.error) return auth.error;
    const resolved = await resolveOrganizationTarget(auth.ctx);
    if (resolved.error) return resolved.error;
    const created = await prisma.$transaction((tx) => seedDefaultTests(tx, resolved.target.organizationId), { timeout: 30000 });
    memoDelete("crud:test:");
    return json({ created, message: created ? `${created} common test(s) added.` : "Common tests already exist." });
  } catch (error) {
    return handleError(error, "Seed default tests");
  }
}
