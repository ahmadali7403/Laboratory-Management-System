import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ADMIN_ROLE_NAMES, apiContext, authorityWhere } from "@/lib/scope";
import { PERMISSION_CATALOG, ensurePermissions } from "@/lib/permissions";
import { fail, handleError, isUuid, json, opt, parseBody, req } from "@/lib/http";

const schema = z.object({
  name: req(2, 60, "Role name").regex(/^[A-Za-z0-9 _-]+$/, "Role name may contain letters, numbers, spaces, hyphen and underscore only.").optional(),
  description: opt(200),
  permissions: z.array(z.string().max(60)).max(100).optional(),
});

async function findRole(actor, id) {
  if (!isUuid(id)) return null;
  const where = { id, name: { notIn: ADMIN_ROLE_NAMES }, isSystem: false };
  const org = authorityWhere(actor).organizationId;
  if (org) where.organizationId = org;
  return prisma.role.findFirst({ where, select: { id: true, organizationId: true } });
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const auth = await apiContext(request, { roles: ["SUPER_ADMIN", "ORGANIZATION_ADMIN"] });
    if (auth.error) return auth.error;
    const role = await findRole(auth.ctx.actor, id);
    if (!role) return fail("Role not found or it is a protected system role.", 404);
    const parsed = await parseBody(request, schema);
    if (parsed.error) return parsed.error;
    const { permissions, ...rest } = parsed.data;

    await prisma.$transaction(async (tx) => {
      if (Object.keys(rest).length) await tx.role.update({ where: { id }, data: rest });
      if (permissions) {
        await ensurePermissions(tx);
        const valid = new Set(PERMISSION_CATALOG.map((p) => p.key));
        const perms = await tx.permission.findMany({ where: { key: { in: permissions.filter((k) => valid.has(k)) } }, select: { id: true } });
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        await tx.rolePermission.createMany({ data: perms.map((p) => ({ roleId: id, permissionId: p.id })) });
      }
    });
    return json({ message: "Role updated." });
  } catch (error) {
    return handleError(error, "Role update", "A role with this name already exists.");
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const auth = await apiContext(request, { roles: ["SUPER_ADMIN", "ORGANIZATION_ADMIN"] });
    if (auth.error) return auth.error;
    const role = await findRole(auth.ctx.actor, id);
    if (!role) return fail("Role not found or it is a protected system role.", 404);
    const users = await prisma.userRole.count({ where: { roleId: id } });
    if (users > 0) return fail(`This role is assigned to ${users} staff member(s). Reassign them first.`, 409);
    await prisma.role.delete({ where: { id } });
    return json({ message: "Role deleted." });
  } catch (error) {
    return handleError(error, "Role delete");
  }
}
