import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ADMIN_ROLE_NAMES, apiContext, authorityWhere } from "@/lib/scope";
import { fail, handleError, isUuid, json, opt, parseBody, req, uuid } from "@/lib/http";
import { personName, phoneField } from "@/lib/validators";

const schema = z.object({
  name: personName("Name").optional(),
  email: z.string().trim().email("Invalid email address.").max(120).optional(),
  phone: phoneField,
  roleId: uuid.optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

async function findStaff(actor, id) {
  if (!isUuid(id)) return null;
  return prisma.user.findFirst({
    where: {
      id,
      organizationId: authorityWhere(actor).organizationId,
      ...(actor.role === "BRANCH_ADMIN" ? { memberships: { some: { branchId: actor.branchId } } } : {}),
      userRoles: { some: { role: { name: { notIn: ADMIN_ROLE_NAMES } } } },
    },
    select: { id: true, organizationId: true, memberships: { select: { branchId: true } } },
  });
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const staff = await findStaff(auth.ctx.actor, id);
    if (!staff) return fail("Staff member not found.", 404);
    const parsed = await parseBody(request, schema);
    if (parsed.error) return parsed.error;
    const { roleId, ...rest } = parsed.data;

    await prisma.$transaction(async (tx) => {
      if (roleId) {
        const role = await tx.role.findFirst({ where: { id: roleId, organizationId: staff.organizationId, name: { notIn: ADMIN_ROLE_NAMES }, OR: [{ branchId: null }, { branchId: { in: staff.memberships.map((m) => m.branchId) } }] }, select: { id: true } });
        if (!role) throw Object.assign(new Error("ROLE"), { code: "P2025" });
        await tx.userRole.deleteMany({ where: { userId: staff.id } });
        await tx.userRole.create({ data: { organizationId: staff.organizationId, userId: staff.id, roleId } });
      }
      if (Object.keys(rest).length) await tx.user.update({ where: { id: staff.id }, data: rest });
    });
    return json({ message: "Staff member updated." });
  } catch (error) {
    return handleError(error, "Staff update", "A staff member with this email already exists.");
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const staff = await findStaff(auth.ctx.actor, id);
    if (!staff) return fail("Staff member not found.", 404);
    await prisma.user.delete({ where: { id: staff.id } });
    return json({ message: "Staff member removed." });
  } catch (error) {
    return handleError(error, "Staff delete");
  }
}
