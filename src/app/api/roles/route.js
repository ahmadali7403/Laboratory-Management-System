import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ADMIN_ROLE_NAMES, apiContext, resolveOrganizationTarget } from "@/lib/scope";
import { ensurePermissions, PERMISSION_CATALOG } from "@/lib/permissions";
import { fail, handleError, json, opt, parseBody, req } from "@/lib/http";

export async function GET(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const organizationId = auth.ctx.scope.organizationId;
    const optionsOnly = new URL(request.url).searchParams.get("options") === "1";
    // Branch admins may only read assignable role names (for the staff form).
    if (auth.ctx.actor.role === "BRANCH_ADMIN" && !optionsOnly) return fail("Forbidden.", 403);
    if (!organizationId) return json({ items: [], catalog: PERMISSION_CATALOG, needsOrganization: true });
    if (optionsOnly) {
      const list = await prisma.role.findMany({
        where: { organizationId, name: { notIn: ADMIN_ROLE_NAMES } },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });
      return json({ items: list });
    }
    await ensurePermissions(prisma);
    const roles = await prisma.role.findMany({
      where: { organizationId },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      include: { permissions: { select: { permission: { select: { key: true } } } }, _count: { select: { userRoles: true } } },
    });
    return json({
      items: roles.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem || ADMIN_ROLE_NAMES.includes(r.name),
        users: r._count.userRoles,
        permissions: r.permissions.map((p) => p.permission.key),
      })),
      catalog: PERMISSION_CATALOG,
    });
  } catch (error) {
    return handleError(error, "Roles list");
  }
}

const schema = z.object({
  name: req(2, 60, "Role name").regex(/^[A-Za-z0-9 _-]+$/, "Role name may contain letters, numbers, spaces, hyphen and underscore only."),
  description: opt(200),
  permissions: z.array(z.string().max(60)).max(100).default([]),
});

export async function POST(request) {
  try {
    const auth = await apiContext(request, { roles: ["SUPER_ADMIN", "ORGANIZATION_ADMIN"] });
    if (auth.error) return auth.error;
    const parsed = await parseBody(request, schema);
    if (parsed.error) return parsed.error;
    const resolved = await resolveOrganizationTarget(auth.ctx);
    if (resolved.error) return resolved.error;
    const { organizationId } = resolved.target;

    const name = parsed.data.name.trim();
    if (ADMIN_ROLE_NAMES.includes(name.toUpperCase().replace(/ /g, "_"))) return fail("This role name is reserved.", 400);
    const valid = new Set(PERMISSION_CATALOG.map((p) => p.key));
    const keys = [...new Set(parsed.data.permissions)].filter((k) => valid.has(k));

    await ensurePermissions(prisma);
    const perms = await prisma.permission.findMany({ where: { key: { in: keys } }, select: { id: true } });
    const role = await prisma.role.create({
      data: {
        organizationId,
        name,
        description: parsed.data.description,
        permissions: { create: perms.map((p) => ({ permissionId: p.id })) },
      },
      select: { id: true },
    });
    return json({ id: role.id, message: "Role created." }, 201);
  } catch (error) {
    return handleError(error, "Role create", "A role with this name already exists.");
  }
}
