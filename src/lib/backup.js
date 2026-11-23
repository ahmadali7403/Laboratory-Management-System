import { prisma } from "@/lib/prisma";
import { serialize, isUuid } from "@/lib/http";

/**
 * Backup / restore engine.
 *  - A backup is a JSON document for ONE organization (optionally ONE branch).
 *  - Restore never trusts organizationId / branchId inside the file: they are
 *    re-validated against the actor's authority and the database, every row
 *    id must be a UUID and must not collide with another tenant's data.
 */
export const BACKUP_MODULES = ["tests", "doctors", "suppliers", "patients", "inventory", "orders", "expenses", "purchases"];
export const MODULE_LABELS = {
  tests: "Test catalog", doctors: "Doctors", suppliers: "Suppliers", patients: "Patients", inventory: "Inventory",
  orders: "Orders, samples, results & payments", expenses: "Expenses", purchases: "Purchases",
};

const DATES = new Set(["createdAt", "updatedAt", "dateOfBirth", "expenseDate", "purchaseDate", "receivedAt", "completedAt", "cancelledAt", "collectedAt", "enteredAt", "verifiedAt"]);
const SIMPLE = {
  tests: { model: "test", fields: ["id", "branchId", "code", "name", "category", "sampleType", "price", "unit", "refLow", "refHigh", "refRangeText", "turnaroundHours", "isActive", "createdAt"] },
  doctors: { model: "doctor", fields: ["id", "branchId", "name", "specialization", "phone", "email", "isActive", "createdAt"] },
  suppliers: { model: "supplier", fields: ["id", "branchId", "name", "contactPerson", "phone", "email", "address", "isActive", "createdAt"] },
  patients: { model: "patient", fields: ["id", "branchId", "mrn", "name", "fatherName", "isWalkIn", "gender", "dateOfBirth", "phone", "email", "cnic", "address", "notes", "createdAt"] },
  inventory: { model: "inventoryItem", fields: ["id", "branchId", "name", "sku", "unit", "quantity", "reorderLevel", "unitCost", "isActive", "createdAt"] },
  expenses: { model: "expense", fields: ["id", "branchId", "category", "description", "amount", "expenseDate", "createdByName", "createdAt"] },
};
const F = {
  parameter: ["id", "name", "unit", "refLow", "refHigh", "refRangeText", "sortOrder"],
  order: ["id", "branchId", "orderNo", "patientId", "doctorId", "status", "paymentStatus", "subtotal", "discount", "total", "paidAmount", "notes", "referredBy", "createdByName", "completedAt", "cancelledAt", "createdAt"],
  sample: ["id", "sampleNo", "sampleType", "status", "collectedAt", "collectedByName", "rejectionReason"],
  item: ["id", "testId", "sampleId", "testName", "testCode", "price", "resultValue", "unit", "refRange", "flag", "resultStatus", "comments", "enteredByName", "enteredAt", "verifiedByName", "verifiedAt"],
  result: ["id", "name", "unit", "refLow", "refHigh", "refRangeText", "sortOrder", "value", "flag"],
  payment: ["id", "amount", "method", "reference", "receivedByName", "createdAt"],
  purchase: ["id", "branchId", "purchaseNo", "supplierId", "status", "total", "purchaseDate", "notes", "receivedAt", "createdByName", "createdAt"],
  purchaseItem: ["id", "inventoryItemId", "quantity", "unitCost"],
};
const pick = (row, fields) => Object.fromEntries(fields.map((f) => [f, row[f] ?? null]));
const ROW_CAP = 50_000;

// ---------------------------------------------------------------------------
export async function collectBackup({ organizationId, branchId = null, modules = BACKUP_MODULES }) {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } });
  const branch = branchId ? await prisma.branch.findFirst({ where: { id: branchId, organizationId }, select: { name: true } }) : null;
  const where = branchId ? { organizationId, branchId } : { organizationId };
  const out = {};

  for (const m of modules) {
    if (SIMPLE[m]) {
      const spec = SIMPLE[m];
      const rows = await prisma[spec.model].findMany({
        where, take: ROW_CAP, orderBy: { createdAt: "asc" },
        ...(m === "tests" ? { include: { parameters: { orderBy: { sortOrder: "asc" } } } } : {}),
      });
      out[m] = rows.map((r) => ({ ...pick(r, spec.fields), ...(m === "tests" ? { parameters: r.parameters.map((p) => pick(p, F.parameter)) } : {}) }));
    } else if (m === "orders") {
      const rows = await prisma.labOrder.findMany({
        where, take: ROW_CAP, orderBy: { createdAt: "asc" },
        include: { samples: true, items: { include: { results: { orderBy: { sortOrder: "asc" } } } }, payments: true },
      });
      out.orders = rows.map((o) => ({
        ...pick(o, F.order),
        samples: o.samples.map((s) => pick(s, F.sample)),
        items: o.items.map((i) => ({ ...pick(i, F.item), results: i.results.map((r) => pick(r, F.result)) })),
        payments: o.payments.map((p) => pick(p, F.payment)),
      }));
    } else if (m === "purchases") {
      const rows = await prisma.purchase.findMany({ where, take: ROW_CAP, orderBy: { createdAt: "asc" }, include: { items: true } });
      out.purchases = rows.map((p) => ({ ...pick(p, F.purchase), items: p.items.map((i) => pick(i, F.purchaseItem)) }));
    }
  }
  return serialize({
    format: "labos-backup", version: 1, createdAt: new Date(),
    scope: { organizationId, organizationName: org?.name || null, branchId, branchName: branch?.name || null },
    modules: out,
  });
}

// ---------------------------------------------------------------------------
class RestoreError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export { RestoreError };

const conv = (row, fields) => {
  const o = {};
  for (const f of fields) {
    if (f === "id" || row[f] === undefined) continue;
    let v = row[f];
    if (v !== null && DATES.has(f)) {
      v = new Date(v);
      if (Number.isNaN(v.getTime())) throw new RestoreError(`Invalid date in field "${f}".`);
    }
    o[f] = v;
  }
  return o;
};
const need = (cond, msg, status) => { if (!cond) throw new RestoreError(msg, status); };
const ids = (rows) => rows.map((r) => r.id);
const checkIds = (rows, label) => {
  const seen = new Set();
  for (const r of rows) {
    need(r && isUuid(r.id), `Invalid record id in ${label}.`);
    need(!seen.has(r.id), `Duplicate record id in ${label}.`);
    seen.add(r.id);
  }
};

/** Throws if any id already belongs to ANOTHER organization (cross-tenant collision). */
async function existingIds(tx, model, rows, organizationId, label) {
  if (!rows.length) return new Set();
  const found = await tx[model].findMany({ where: { id: { in: ids(rows) } }, select: { id: true, organizationId: true } });
  if (found.some((f) => f.organizationId !== organizationId)) throw new RestoreError(`Restore blocked: ${label} contain ids that belong to another organization.`, 409);
  return new Set(found.map((f) => f.id));
}

async function bumpSequence(tx, organizationId, key, values, pattern) {
  let max = 0;
  for (const v of values) { const m = pattern.exec(v || ""); if (m) max = Math.max(max, Number(m[1])); }
  if (!max) return;
  await tx.sequence.createMany({ data: [{ organizationId, key, value: 0 }], skipDuplicates: true });
  const cur = await tx.sequence.findUnique({ where: { organizationId_key: { organizationId, key } } });
  if (cur.value < max) await tx.sequence.update({ where: { organizationId_key: { organizationId, key } }, data: { value: max } });
}

export async function restoreBackups(file, actor, mode = "merge") {
  need(file && typeof file === "object", "Invalid backup file.");
  const backups = file.format === "labos-backup-set" ? file.backups : file.format === "labos-backup" ? [file] : null;
  need(Array.isArray(backups) && backups.length > 0, "This is not a LabOS backup file.");
  need(backups.length <= 200, "Too many organizations in one file.");
  need(["merge", "overwrite"].includes(mode), "Invalid restore mode.");

  const summary = [];
  for (const b of backups) summary.push(await restoreOne(b, actor, mode));
  return summary;
}

async function restoreOne(b, actor, mode) {
  need(b?.format === "labos-backup" && b.version === 1 && b.scope && b.modules && typeof b.modules === "object", "Unsupported backup version.");
  const orgId = b.scope.organizationId;
  const scopeBranch = b.scope.branchId || null;
  need(isUuid(orgId) && (scopeBranch === null || isUuid(scopeBranch)), "Invalid backup scope.");

  // ---- authority: the file can never widen what the actor may touch ----
  if (actor.role === "ORGANIZATION_ADMIN") need(orgId === actor.organizationId, "This backup belongs to a different organization.", 403);
  if (actor.role === "BRANCH_ADMIN") {
    need(orgId === actor.organizationId && scopeBranch === actor.branchId, "You can only restore a backup of your own branch.", 403);
  }

  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, name: true, status: true } });
  need(org, "Organization of this backup does not exist.", 404);
  need(org.status === "ACTIVE", "This organization is not active.", 409);

  const branches = await prisma.branch.findMany({ where: { organizationId: orgId }, select: { id: true } });
  const branchSet = new Set(branches.map((x) => x.id));
  if (scopeBranch) need(branchSet.has(scopeBranch), "Branch of this backup does not exist.", 404);

  const mods = b.modules;
  for (const m of Object.keys(mods)) need(BACKUP_MODULES.includes(m) && Array.isArray(mods[m]), `Unknown section "${m}" in backup.`);
  const total = Object.values(mods).reduce((s, a) => s + a.length, 0);
  need(total <= 200_000, "Backup is too large to restore in one go. Restore module by module.", 413);

  // validate branch ownership of every row up-front
  const orgWideOk = ["tests", "doctors", "suppliers"];
  for (const [m, rows] of Object.entries(mods)) {
    checkIds(rows, m);
    for (const r of rows) {
      const bid = r.branchId ?? null;
      if (bid === null) {
        need(orgWideOk.includes(m), `Record without a branch in ${m}.`);
        need(!scopeBranch && actor.role !== "BRANCH_ADMIN", "Organization-wide records cannot be restored from a branch backup.", 403);
      } else {
        need(isUuid(bid) && branchSet.has(bid), `Record of an unknown branch in ${m}.`, 403);
        need(!scopeBranch || bid === scopeBranch, `Record of another branch in ${m}.`, 403);
        if (actor.role === "BRANCH_ADMIN") need(bid === actor.branchId, "Record of another branch.", 403);
      }
    }
  }

  const counts = {};
  await prisma.$transaction(async (tx) => {
    const base = { organizationId: orgId };
    const overwrite = mode === "overwrite";

    // ---------------- simple modules ----------------
    for (const m of ["tests", "doctors", "suppliers", "patients", "inventory", "expenses"]) {
      const rows = mods[m] || [];
      if (!rows.length) continue;
      const spec = SIMPLE[m];
      const have = await existingIds(tx, spec.model, rows, orgId, m);
      const fresh = rows.filter((r) => !have.has(r.id));
      if (m === "tests") {
        for (const r of fresh) {
          await tx.test.create({ data: { id: r.id, ...base, ...conv(r, spec.fields), parameters: { create: (r.parameters || []).map((p, i) => ({ ...conv(p, F.parameter), id: isUuid(p.id) ? p.id : undefined, sortOrder: p.sortOrder ?? i })) } } });
        }
      } else if (fresh.length) {
        await tx[spec.model].createMany({ data: fresh.map((r) => ({ id: r.id, ...base, ...conv(r, spec.fields) })) });
      }
      let updated = 0;
      if (overwrite) {
        for (const r of rows.filter((x) => have.has(x.id))) {
          const data = conv(r, spec.fields);
          delete data.branchId; // never move a record between branches via restore
          if (m === "tests") {
            await tx.test.update({ where: { id: r.id }, data: { ...data, parameters: { deleteMany: {}, create: (r.parameters || []).map((p, i) => ({ ...conv(p, F.parameter), sortOrder: p.sortOrder ?? i })) } } });
          } else {
            await tx[spec.model].update({ where: { id: r.id }, data });
          }
          updated++;
        }
      }
      counts[m] = { added: fresh.length, updated, skipped: rows.length - fresh.length - updated };
      if (m === "patients") await bumpSequence(tx, orgId, "patient", rows.map((r) => r.mrn), /^MRN-(\d+)$/);
    }

    // ---------------- orders ----------------
    const orders = mods.orders || [];
    if (orders.length) {
      const have = await existingIds(tx, "labOrder", orders, orgId, "orders");
      const todo = orders.filter((o) => overwrite || !have.has(o.id));
      const testIds = [...new Set(todo.flatMap((o) => (o.items || []).map((i) => i.testId)))];
      need(testIds.every(isUuid), "Invalid test reference in orders.");
      if (testIds.length) {
        const tests = await tx.test.count({ where: { id: { in: testIds }, organizationId: orgId } });
        need(tests === testIds.length, "Some tests used by these orders do not exist. Restore the test catalog first.", 409);
      }
      const patientIds = [...new Set(todo.map((o) => o.patientId))];
      need(patientIds.every(isUuid), "Invalid patient reference in orders.");
      const patients = await tx.patient.findMany({ where: { id: { in: patientIds }, organizationId: orgId }, select: { id: true, branchId: true } });
      const pBranch = new Map(patients.map((p) => [p.id, p.branchId]));
      for (const o of todo) {
        need(pBranch.has(o.patientId), "Some patients of these orders do not exist. Restore patients first.", 409);
        need(pBranch.get(o.patientId) === o.branchId, "An order is linked to a patient of another branch.", 403);
      }

      if (overwrite) {
        const exist = todo.filter((o) => have.has(o.id)).map((o) => o.id);
        if (exist.length) {
          await tx.payment.deleteMany({ where: { orderId: { in: exist }, organizationId: orgId } });
          await tx.labOrder.deleteMany({ where: { id: { in: exist }, organizationId: orgId } });
        }
      }
      for (const o of todo) {
        const sampleIds = new Set((o.samples || []).map((s) => s.id));
        await tx.labOrder.create({
          data: {
            id: o.id, ...base, ...conv(o, F.order),
            samples: { create: (o.samples || []).map((s) => ({ id: s.id, ...conv(s, F.sample) })) },
          },
        });
        for (const i of o.items || []) {
          await tx.labOrderItem.create({
            data: {
              id: i.id, orderId: o.id, ...conv(i, F.item), sampleId: i.sampleId && sampleIds.has(i.sampleId) ? i.sampleId : null,
              results: { create: (i.results || []).map((r) => ({ id: r.id, ...conv(r, F.result) })) },
            },
          });
        }
        if ((o.payments || []).length) {
          await tx.payment.createMany({ data: o.payments.map((p) => ({ id: p.id, ...base, branchId: o.branchId, orderId: o.id, ...conv(p, F.payment) })) });
        }
      }
      counts.orders = { added: todo.filter((o) => !have.has(o.id)).length, updated: overwrite ? todo.filter((o) => have.has(o.id)).length : 0, skipped: overwrite ? 0 : orders.length - todo.length };
      await bumpSequence(tx, orgId, "order", orders.map((o) => o.orderNo), /^ORD-(\d+)$/);
    }

    // ---------------- purchases ----------------
    const purchases = mods.purchases || [];
    if (purchases.length) {
      const have = await existingIds(tx, "purchase", purchases, orgId, "purchases");
      const todo = purchases.filter((p) => overwrite || !have.has(p.id));
      const itemIds = [...new Set(todo.flatMap((p) => (p.items || []).map((i) => i.inventoryItemId)))];
      need(itemIds.every(isUuid), "Invalid inventory reference in purchases.");
      const inv = await tx.inventoryItem.findMany({ where: { id: { in: itemIds }, organizationId: orgId }, select: { id: true, branchId: true } });
      const invBranch = new Map(inv.map((x) => [x.id, x.branchId]));
      for (const p of todo) {
        for (const i of p.items || []) {
          need(invBranch.has(i.inventoryItemId), "Some inventory items of these purchases do not exist. Restore inventory first.", 409);
          need(invBranch.get(i.inventoryItemId) === p.branchId, "A purchase is linked to inventory of another branch.", 403);
        }
      }
      if (overwrite) {
        const exist = todo.filter((p) => have.has(p.id)).map((p) => p.id);
        if (exist.length) await tx.purchase.deleteMany({ where: { id: { in: exist }, organizationId: orgId } });
      }
      for (const p of todo) {
        await tx.purchase.create({ data: { id: p.id, ...base, ...conv(p, F.purchase), items: { create: (p.items || []).map((i) => ({ id: i.id, ...conv(i, F.purchaseItem) })) } } });
      }
      counts.purchases = { added: todo.filter((p) => !have.has(p.id)).length, updated: overwrite ? todo.filter((p) => have.has(p.id)).length : 0, skipped: overwrite ? 0 : purchases.length - todo.length };
      await bumpSequence(tx, orgId, "purchase", purchases.map((p) => p.purchaseNo), /^PUR-(\d+)$/);
    }
  }, { maxWait: 20_000, timeout: 300_000 });

  return { organization: org.name, branchId: scopeBranch, counts };
}
