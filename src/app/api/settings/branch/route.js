import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiContext } from "@/lib/scope";
import { fail, handleError, json, opt, parseBody, req } from "@/lib/http";

const select = { id: true, name: true, code: true, email: true, phone: true, address: true, city: true, status: true, isHeadOffice: true };

export async function GET(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const { scope } = auth.ctx;
    if (!scope.branchId) return fail("Select a branch first.", 400);
    const branch = await prisma.branch.findFirst({ where: { id: scope.branchId, organizationId: scope.organizationId }, select });
    return branch ? json(branch) : fail("Branch not found.", 404);
  } catch (error) {
    return handleError(error, "Branch settings");
  }
}

const schema = z.object({
  name: req(2, 120, "Branch name"),
  email: z.string().trim().email("Invalid email address.").max(120).nullish().or(z.literal("")).transform((v) => v || null),
  phone: opt(30),
  address: opt(300),
  city: opt(100),
});

export async function PATCH(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const { scope } = auth.ctx;
    if (!scope.branchId) return fail("Select a branch first.", 400);
    const parsed = await parseBody(request, schema);
    if (parsed.error) return parsed.error;
    const exists = await prisma.branch.findFirst({ where: { id: scope.branchId, organizationId: scope.organizationId }, select: { id: true } });
    if (!exists) return fail("Branch not found.", 404);
    const branch = await prisma.branch.update({ where: { id: scope.branchId }, data: parsed.data, select });
    return json({ ...branch, message: "Branch settings saved." });
  } catch (error) {
    return handleError(error, "Branch settings update");
  }
}
