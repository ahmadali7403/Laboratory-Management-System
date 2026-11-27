import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ADMIN_ROLE_NAMES, apiContext, authorityWhere } from "@/lib/scope";
import { ensurePermissions, grantableKeys } from "@/lib/permissions";
import { assertRoleNameFree } from "@/lib/roles";
import { fail, handleError, isUuid, json, opt, parseBody, req } from "@/lib/http";
import { memoDelete } from "@/lib/memo";
import { clientIp, logAudit } from "@/lib/audit";

const schema = z.object({
  name: req(2, 60, "Role name").regex(/^[A-Za-z0-9 _-]+$/, "Role name may contain letters, numbers, spaces, hyphen and underscore only.").optional(),
  description: opt(200),
  permissions: z.array(z.string().max(60)).max(120).optional(),
  maxDiscountPct: z.coerce.number().min(0).max(100).optional(),
  canEditPrice: z.boolean().optional(),
  allowedMethods: z.array(z.string().max(30)).max(10).optional(),
  requireShift: z.boolean().optional(),
});

async function findRole(actor, id) {
  if (!isUuid(id)) return null;
  const where = { id, name: { notIn: ADMIN_ROLE_NAMES }, isSystem: false };
  const org = authorityWhere(actor).organizationId;
  if (org) where.organizationId = org;
  // A branch admin can only touch roles of its own branch: never org-wide roles, never another branch's.
  if (actor.role === "BRANCH_ADMIN") where.branchId = actor.branchId;
  return prisma.role.findFirst({ where, select: { id: true, organizationId: true, branchId: true, name: true } });
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const actor = auth.ctx.actor;
    if (!isUuid(id)) return fail("Role not found.", 404);
    const where = { id };
    const org = authorityWhere(actor).organizationId;
    if (org) where.organizationId = org;
    // branch admin: organization-wide roles (read only) or its own branch's roles
    if (actor.role === "BRANCH_ADMIN") where.OR = [{ branchId: null }, { branchId: actor.branchId }];
    const r = await prisma.role.findFirst({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        permissions: { select: { permission: { select: { key: true } } } },
        userRoles: { select: { user: { select: { id: true, name: true, email: true, status: true } } }, take: 200 },
      },
    });
    if (!r) return fail("Role not found.", 404);
    const system = r.isSystem || ADMIN_ROLE_NAMES.includes(r.name);
    return json({
      id: r.id, name: r.name, description: r.description, isSystem: system, branchId: r.branchId, branchName: r.branch?.name || null,
      editable: !system && (actor.role !== "BRANCH_ADMIN" || r.branchId === actor.branchId),
      maxDiscountPct: Number(r.maxDiscountPct ?? 100),
      canEditPrice: r.canEditPrice !== false,
      allowedMethods: r.allowedMethods || [],
      requireShift: Boolean(r.requireShift),
      permissions: r.permissions.map((p) => p.permission.key),
      staff: actor.role === "BRANCH_ADMIN" && r.branchId === null ? [] : r.userRoles.map((u) => u.user),
    });
  } catch (error) {
    return handleError(error, "Role detail");
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const auth = await apiContext(request, { roles: ["SUPER_ADMIN", "ORGANIZATION_ADMIN", "BRANCH_ADMIN"] });
    if (auth.error) return auth.error;
    const role = await findRole(auth.ctx.actor, id);
    if (!role) return fail("Role not found or it is a protected system role.", 404);
    const parsed = await parseBody(request, schema);
    if (parsed.error) return parsed.error;
    const { permissions, ...rest } = parsed.data;
    if (rest.name && rest.name.trim().toLowerCase() !== role.name.toLowerCase()) {
      if (ADMIN_ROLE_NAMES.includes(rest.name.trim().toUpperCase().replace(/ /g, "_"))) return fail("This role name is reserved.", 400);
      await assertRoleNameFree(prisma, { organizationId: role.organizationId, branchId: role.branchId, name: rest.name.trim(), exceptId: role.id });
    }

    const actor = auth.ctx.actor;
    await prisma.$transaction(async (tx) => {
      if (Object.keys(rest).length) await tx.role.update({ where: { id }, data: rest });
      if (permissions) {
        await ensurePermissions(tx);
        const perms = await tx.permission.findMany({ where: { key: { in: grantableKeys(actor, permissions) } }, select: { id: true } });
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        await tx.rolePermission.createMany({ data: perms.map((p) => ({ roleId: id, permissionId: p.id })) });
      }
    });
    memoDelete("perms:");
    await logAudit({
      organizationId: role.organizationId,
      branchId: role.branchId,
      userId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: "ROLE_UPDATED",
      resource: "ROLE",
      resourceId: role.id,
      summary: `${actor.name} updated role ${rest.name || role.name}`,
      ip: clientIp(request),
    });
    return json({ message: "Role updated." });
  } catch (error) {
    return handleError(error, "Role update", "A role with this name already exists.");
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const auth = await apiContext(request, { roles: ["SUPER_ADMIN", "ORGANIZATION_ADMIN", "BRANCH_ADMIN"] });
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
