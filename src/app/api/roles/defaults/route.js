import { prisma } from "@/lib/prisma";
import { apiContext } from "@/lib/scope";
import { fail, handleError, json } from "@/lib/http";
import { seedDefaultRoles } from "@/lib/default-roles";

// Adds any missing standard roles (Receptionist, Cashier, Lab Technician ...) to the branch in view.
export async function POST(request) {
  try {
    const auth = await apiContext(request, { roles: ["SUPER_ADMIN", "ORGANIZATION_ADMIN", "BRANCH_ADMIN"] });
    if (auth.error) return auth.error;
    const { organizationId, branchId } = auth.ctx.scope;
    if (!organizationId || !branchId) return fail("Select a branch in the top bar first.", 400);
    const created = await seedDefaultRoles(prisma, organizationId, branchId);
    return json({ created, message: created ? `${created} standard role(s) added.` : "All standard roles already exist." });
  } catch (error) {
    return handleError(error, "Default roles");
  }
}
