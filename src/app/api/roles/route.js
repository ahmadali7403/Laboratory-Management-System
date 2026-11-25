import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ADMIN_ROLE_NAMES, apiContext, resolveOrganizationTarget } from "@/lib/scope";
import { ensurePermissions, grantableKeys, PERMISSION_CATALOG } from "@/lib/permissions";
import { fail, handleError, json, opt, optUuid, parseBody, req } from "@/lib/http";
import { assertRoleNameFree } from "@/lib/roles";

export async function GET(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const organizationId = auth.ctx.scope.organizationId;
    const optionsOnly = new URL(request.url).searchParams.get("options") === "1";
    const actor = auth.ctx.actor;
    const isBranch = actor.role === "BRANCH_ADMIN";
    const isSuper = actor.role === "SUPER_ADMIN";
    if (!organizationId && !isSuper) return json({ items: [], catalog: PERMISSION_CATALOG });
    // Branch admin sees organization-wide roles (read only) plus roles of ITS OWN branch.
    // Org/super admins with a branch selected also see that branch's roles.
    const scopeBranch = isBranch ? actor.branchId : auth.ctx.scope.branchId;
    const branchFilter = scopeBranch ? { OR: [{ branchId: null }, { branchId: scopeBranch }] } : {};
    if (optionsOnly) {
      const list = await prisma.role.findMany({
        where: { ...(organizationId ? { organizationId } : {}), name: { notIn: ADMIN_ROLE_NAMES }, ...branchFilter },
        orderBy: { name: "asc" },
        select: { id: true, name: true, branchId: true, branch: { select: { name: true } } },
      });
      return json({ items: list.map((r) => ({ id: r.id, name: r.name, branchId: r.branchId, branchName: r.branch?.name || null })) });
    }
    await ensurePermissions(prisma);
    const roles = await prisma.role.findMany({
      // Super admin with no organization selected sees the roles of every organization.
      where: { ...(organizationId ? { organizationId } : {}), ...branchFilter },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      take: 500,
      include: {
        organization: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } }, permissions: { select: { permission: { select: { key: true } } } }, _count: { select: { userRoles: true } } },
    });
    return json({
      items: roles.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem || ADMIN_ROLE_NAMES.includes(r.name),
        users: r._count.userRoles,
        branchId: r.branchId,
        branchName: r.branch?.name || null,
        organizationId: r.organizationId,
        organizationName: r.organization?.name || null,
        // branch admins can only change roles that belong to their own branch
        editable: !(r.isSystem || ADMIN_ROLE_NAMES.includes(r.name)) && (!isBranch || r.branchId === actor.branchId),
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
  // Who the role is for. Ignored/verified server-side according to the signed-in level:
  //   BRANCH_ADMIN        -> always its own branch
  //   ORGANIZATION_ADMIN  -> branchId = null (all branches) or one of its branches
  //   SUPER_ADMIN         -> organizationId (or applyToAll) + optional branchId
  organizationId: optUuid,
  branchId: optUuid,
  applyToAll: z.boolean().optional(),
});

export async function POST(request) {
  try {
    const auth = await apiContext(request, { roles: ["SUPER_ADMIN", "ORGANIZATION_ADMIN", "BRANCH_ADMIN"] });
    if (auth.error) return auth.error;
    const parsed = await parseBody(request, schema);
    if (parsed.error) return parsed.error;
    const actor = auth.ctx.actor;
    const name = parsed.data.name.trim();
    if (ADMIN_ROLE_NAMES.includes(name.toUpperCase().replace(/ /g, "_"))) return fail("This role name is reserved.", 400);
    const keys = grantableKeys(actor, parsed.data.permissions);
    const { description } = parsed.data;

    // ---- decide the target(s) entirely on the server -------------------------------------
    let targets = []; // [{ organizationId, branchId }]
    if (actor.role === "BRANCH_ADMIN") {
      targets = [{ organizationId: actor.organizationId, branchId: actor.branchId }]; // from the session, never the body
    } else {
      let branchId = parsed.data.branchId ?? null;
      if (actor.role === "ORGANIZATION_ADMIN") {
        if (branchId === null && parsed.data.branchId === undefined && auth.ctx.scope.branchId) branchId = auth.ctx.scope.branchId;
        targets = [{ organizationId: actor.organizationId, branchId }];
      } else if (parsed.data.applyToAll) {
        if (branchId) return fail("A role for all organizations cannot be limited to one branch.", 400);
        const orgs = await prisma.organization.findMany({ select: { id: true }, take: 1000 });
        targets = orgs.map((o) => ({ organizationId: o.id, branchId: null }));
      } else {
        const organizationId = parsed.data.organizationId || auth.ctx.scope.organizationId;
        if (!organizationId) return fail("Please choose an organization (or “All organizations”).", 400);
        if (branchId === null && parsed.data.branchId === undefined && auth.ctx.scope.branchId) branchId = auth.ctx.scope.branchId;
        targets = [{ organizationId, branchId }];
      }
      // verify every requested organization / branch really exists and belongs together
      for (const t of targets) {
        if (t.branchId) {
          const branch = await prisma.branch.findFirst({ where: { id: t.branchId, organizationId: t.organizationId }, select: { id: true } });
          if (!branch) return fail("Branch not found.", 404);
        } else if (actor.role === "SUPER_ADMIN" && !parsed.data.applyToAll) {
          const org = await prisma.organization.findUnique({ where: { id: t.organizationId }, select: { id: true } });
          if (!org) return fail("Organization not found.", 404);
        }
      }
    }

    await ensurePermissions(prisma);
    const perms = await prisma.permission.findMany({ where: { key: { in: keys } }, select: { id: true } });

    let created = 0;
    let skipped = 0;
    let firstId = null;
    for (const t of targets) {
      try {
        await assertRoleNameFree(prisma, { ...t, name });
      } catch (e) {
        if (targets.length === 1) throw e; // single target: tell the user
        skipped += 1; // "all organizations": skip those that already have this name
        continue;
      }
      const role = await prisma.role.create({
        data: {
          organizationId: t.organizationId,
          branchId: t.branchId,
          name,
          description,
          permissions: { create: perms.map((p) => ({ permissionId: p.id })) },
        },
        select: { id: true },
      });
      firstId ||= role.id;
      created += 1;
    }
    const message = targets.length > 1
      ? `Role created in ${created} organization(s)${skipped ? `, ${skipped} skipped (name already used)` : ""}.`
      : "Role created.";
    return json({ id: firstId, created, skipped, message }, 201);
  } catch (error) {
    return handleError(error, "Role create", "A role with this name already exists.");
  }
}
