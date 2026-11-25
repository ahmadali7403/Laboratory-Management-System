import { prisma } from "@/lib/prisma";
import { apiContext, authorityWhere, resolveWriteTarget, scopeWhere } from "@/lib/scope";
import { fail, handleError, isUuid, json, paging, parseBody, serialize } from "@/lib/http";

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
  } = cfg;

  const db = () => prisma[model];

  async function GET(request) {
    try {
      const auth = await apiContext(request);
      if (auth.error) return auth.error;
      const { scope } = auth.ctx;
      const sp = new URL(request.url).searchParams;
      const q = (sp.get("q") || "").trim().slice(0, 100);
      const { page, pageSize, skip, take } = paging(sp);

      const and = [scopeWhere(scope, { shared: orgWide })];
      if (q && searchFields.length) {
        and.push({ OR: searchFields.map((f) => ({ [f]: { contains: q, mode: "insensitive" } })) });
      }
      if (filters) and.push(...(await filters(sp, scope)));
      const where = { AND: and };

      const [items, total] = await Promise.all([
        db().findMany({ where, orderBy, skip, take, include }),
        db().count({ where }),
      ]);
      const more = extra ? await extra(where, scope) : {};
      return json({ items, total, page, pageSize, ...more });
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
      return json(row);
    } catch (error) {
      return handleError(error, `${label} update`, conflictMessage);
    }
  }

  async function DELETE(request, { params }) {
    try {
      if (!allowDelete) return fail("Delete is not allowed for this record type.", 405);
      const { id } = await params;
      const auth = await apiContext(request);
      if (auth.error) return auth.error;
      const existing = await findOwned(auth.ctx.actor, id);
      if (!existing) return fail(`${label} not found.`, 404);
      try {
        await db().delete({ where: { id } });
      } catch (error) {
        if (error?.code === "P2003") {
          return fail(`This ${label.toLowerCase()} is used by other records and cannot be deleted. Deactivate it instead.`, 409);
        }
        throw error;
      }
      return json({ message: `${label} deleted.` });
    } catch (error) {
      return handleError(error, `${label} delete`);
    }
  }

  return { collection: { GET, POST }, item: { PATCH, DELETE } };
}

export { serialize };
