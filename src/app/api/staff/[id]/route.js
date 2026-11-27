import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ADMIN_ROLE_NAMES, apiContext, authorityWhere } from "@/lib/scope";
import { fail, handleError, isUuid, json, opt, parseBody, req, uuid } from "@/lib/http";
import bcrypt from "bcryptjs";
import { passwordField, personName, phoneField, pinField, usernameField } from "@/lib/validators";
import { usernameTaken } from "@/lib/usernames";
import { memoDelete } from "@/lib/memo";

const schema = z.object({
  name: personName("Name").optional(),
  email: z.string().trim().email("Invalid email address.").max(120).optional(),
  phone: phoneField,
  roleId: uuid.optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  username: usernameField.optional(),
  password: passwordField.optional().or(z.literal("").transform(() => undefined)),
  pin: pinField.optional(),
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
    const { roleId, password, pin, ...rest } = parsed.data;
    if (rest.username && (await usernameTaken(rest.username, staff.id))) return fail("This username is already taken. Choose another one.", 409);
    if (password) rest.password = await bcrypt.hash(password, 10);
    if (pin !== undefined) rest.pinHash = pin ? await bcrypt.hash(pin, 10) : null;

    await prisma.$transaction(async (tx) => {
      if (roleId) {
        const role = await tx.role.findFirst({ where: { id: roleId, organizationId: staff.organizationId, name: { notIn: ADMIN_ROLE_NAMES }, OR: [{ branchId: null }, { branchId: { in: staff.memberships.map((m) => m.branchId) } }] }, select: { id: true } });
        if (!role) throw Object.assign(new Error("ROLE"), { code: "P2025" });
        await tx.userRole.deleteMany({ where: { userId: staff.id } });
        await tx.userRole.create({ data: { organizationId: staff.organizationId, userId: staff.id, roleId } });
      }
      if (Object.keys(rest).length) await tx.user.update({ where: { id: staff.id }, data: rest });
    });
    memoDelete(`perms:${staff.id}`);
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
