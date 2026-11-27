import { prisma } from "@/lib/prisma";
import { apiContext, authorityWhere, resolveWriteTarget, scopeWhere } from "@/lib/scope";
import { fail, handleError, isUuid, json, paging, parseBody, serialize } from "@/lib/http";
import { memo, memoDelete } from "@/lib/memo";

/**
 * Generic, tenant-safe CRUD for simple modules (patients, doctors, tests,
 * suppliers, inventory, expenses). Every handler:
 *   - authenticates and resolves the actor's scope from the database,
 *   - filters list queries with scopeWhere(),
 *   - filters access-by-id with authorityWhere() (IDOR protection),
 *   - derives organizationId/branchId on create via resolveWriteTarget().
 */
export function createCrud(cfg) {
  const {
    model,
    label,
    orgWide = false,
    createSchema,
    updateSchema = createSchema.partial(),
    searchFields = [],
    orderBy = [{ createdAt: "desc" }],
    include = { branch: { select: { id: true, name: true, code: true } } },
    filters,
    extra,
    beforeCreate,
    beforeUpdate,
    afterWrite,
    conflictMessage,
    allowDelete = true,
    dependents = [], // relation names that block a hard delete (see DELETE)
    cacheTtlMs = 0, // short per-scope cache for rarely changing reference lists (e.g. test catalog)
  } = cfg;

  const db = () => prisma[model];

  // Cache keys always include the actor, role and full scope, so one user/branch can never
  // receive another one's cached list. Any write to this model clears every entry of the model.
  const cachePrefix = `crud:${model}:`;
  const invalidateCache = () => { if (cacheTtlMs) memoDelete(cachePrefix); };

  async function GET(request) {
    try {
      const auth = await apiContext(request);
      if (auth.error) return auth.error;
      const { scope } = auth.ctx;
      const sp = new URL(request.url).searchParams;
      const q = (sp.get("q") || "").trim().slice(0, 100);
      const { page, pageSize, skip, take } = paging(sp);
      const inc = sp.get("light") === "1" ? undefined : include; // light = plain columns only (faster lists)

      const and = [scopeWhere(scope, { shared: orgWide })];
      if (q && searchFields.length) {
        and.push({ OR: searchFields.map((f) => ({ [f]: { contains: q, mode: "insensitive" } })) });
      }
      if (filters) and.push(...(await filters(sp, scope)));
      const where = { AND: and };

      const load = async () => {
        const [items, total] = await Promise.all([
          db().findMany({ where, orderBy, skip, take, ...(inc ? { include: inc } : {}) }),
          db().count({ where }),
        ]);
        const more = extra ? await extra(where, scope) : {};
        return { items, total, page, pageSize, ...more };
      };
      const result = cacheTtlMs
        ? await memo(`${cachePrefix}${auth.ctx.actor.role}:${auth.ctx.actor.id}:${scope.organizationId || ""}:${scope.branchId || ""}:${sp.toString()}`, cacheTtlMs, load)
        : await load();
      return json(result);
    } catch (error) {
      return handleError(error, `${label} list`);
    }
  }

  async function POST(request) {
    try {
      const auth = await apiContext(request);
      if (auth.error) return auth.error;
      const parsed = await parseBody(request, createSchema);
      if (parsed.error) return parsed.error;

      const resolved = await resolveWriteTarget(auth.ctx, parsed.data, { branchRequired: !orgWide });
      if (resolved.error) return resolved.error;
      const { target } = resolved;
      const { branchId: _ignored, ...rest } = parsed.data;

      const row = await prisma.$transaction(async (tx) => {
        const ctx = { ...auth.ctx, target, tx };
        const data = beforeCreate ? await beforeCreate(ctx, rest) : rest;
        const created = await tx[model].create({
          data: { ...data, organizationId: target.organizationId, branchId: target.branchId },
          include,
        });
        if (afterWrite) await afterWrite(ctx, created);
        return created;
      });
      invalidateCache();
      return json(row, 201);
    } catch (error) {
      return handleError(error, `${label} create`, conflictMessage);
    }
  }

  async function findOwned(actor, id) {
    if (!isUuid(id)) return null;
    return db().findFirst({ where: { id, ...authorityWhere(actor) } });
  }

  async function PATCH(request, { params }) {
    try {
      const { id } = await params;
      const auth = await apiContext(request);
      if (auth.error) return auth.error;
      const existing = await findOwned(auth.ctx.actor, id);
      if (!existing) return fail(`${label} not found.`, 404);

      const parsed = await parseBody(request, updateSchema);
      if (parsed.error) return parsed.error;
      const { branchId: _ignored, ...data } = parsed.data;

      const row = await prisma.$transaction(async (tx) => {
        const patch = beforeUpdate ? await beforeUpdate(data, existing) : data;
        const updated = await tx[model].update({ where: { id }, data: patch, include });
        if (afterWrite) await afterWrite({ ...auth.ctx, target: { organizationId: existing.organizationId, branchId: existing.branchId }, tx }, updated);
        return updated;
      });
      invalidateCache();
      return json(row);
    } catch (error) {
      return handleError(error, `${label} update`, conflictMessage);
    }
  }

  // Prisma reports "still referenced" as P2003 (FK) or P2014 (required relation).
  const isLinkedError = (e) => e?.code === "P2003" || e?.code === "P2014";

  async function DELETE(request, { params }) {
    try {
      if (!allowDelete) return fail("Delete is not allowed for this record type.", 405);
      const { id } = await params;
      const auth = await apiContext(request);
      if (auth.error) return auth.error;
      const existing = await findOwned(auth.ctx.actor, id);
      if (!existing) return fail(`${label} not found.`, 404);

      const name = label.toLowerCase();
      // Records that already have transactions are never hard-deleted: they are deactivated
      // when the model supports it (keeps history intact), otherwise the delete is refused.
      async function blockedResponse() {
        if ("isActive" in existing) {
          if (existing.isActive) await db().update({ where: { id }, data: { isActive: false } });
          return json({
            message: `This ${name} is used by other records, so it was deactivated instead of deleted.`,
            deactivated: true,
          });
        }
        return fail(`This ${name} has linked records (such as orders) and cannot be deleted.`, 409);
      }

      if (dependents.length) {
        const counts = await db().findFirst({
          where: { id },
          select: { _count: { select: Object.fromEntries(dependents.map((d) => [d, true])) } },
        });
        if (dependents.some((d) => (counts?._count?.[d] || 0) > 0)) return await blockedResponse();
      }

      try {
        await db().delete({ where: { id } });
      } catch (error) {
        if (isLinkedError(error)) return await blockedResponse();
        throw error;
      }
      invalidateCache();
      return json({ message: `${label} deleted.` });
    } catch (error) {
      return handleError(error, `${label} delete`);
    }
  }

  return { collection: { GET, POST }, item: { PATCH, DELETE } };
}

export { serialize };
