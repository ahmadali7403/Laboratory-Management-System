import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiContext, hasPermission, resolveWriteTarget, scopeWhere, verifyManagerOverride } from "@/lib/scope";
import { clientIp, logAudit } from "@/lib/audit";
import { fail, handleError, json, money, opt, optUuid, paging, parseBody, req, round2, uuid } from "@/lib/http";
import { nextNumber } from "@/lib/sequence";
import { notify } from "@/lib/notify";
import { paymentStatusFor } from "@/lib/lab";
import { invalidateStatsCache } from "@/lib/memo";
import { NAME_MESSAGE, NAME_RE, phoneField } from "@/lib/validators";

const STATUSES = ["REGISTERED", "SAMPLE_COLLECTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const PAY = ["UNPAID", "PARTIAL", "PAID"];

export async function GET(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const { scope } = auth.ctx;
    const sp = new URL(request.url).searchParams;
    const { page, pageSize, skip, take } = paging(sp);
    const q = (sp.get("q") || "").trim().slice(0, 100);
    const status = sp.get("status");
    const paymentStatus = sp.get("paymentStatus");

    const and = [scopeWhere(scope)];
    if (STATUSES.includes(status)) and.push({ status });
    if (paymentStatus === "OPEN") and.push({ paymentStatus: { in: ["UNPAID", "PARTIAL"] }, status: { not: "CANCELLED" } });
    else if (PAY.includes(paymentStatus)) and.push({ paymentStatus, status: { not: "CANCELLED" } });
    if (q) {
      and.push({
        OR: [
          { orderNo: { contains: q, mode: "insensitive" } },
          { patient: { name: { contains: q, mode: "insensitive" } } },
          { patient: { mrn: { contains: q, mode: "insensitive" } } },
          { patient: { phone: { contains: q, mode: "insensitive" } } },
        ],
      });
    }
    const where = { AND: and };
    const [items, total] = await Promise.all([
      prisma.labOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          patient: { select: { id: true, name: true, mrn: true, phone: true } },
          branch: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.labOrder.count({ where }),
    ]);
    return json({ items, total, page, pageSize });
  } catch (error) {
    return handleError(error, "Orders list");
  }
}

const createSchema = z.object({
  branchId: optUuid,
  patientId: uuid.optional(),
  walkIn: z
    .object({
      name: z.string().trim().max(120).optional().default(""),
      gender: z.enum(["MALE", "FEMALE", "OTHER"]).default("OTHER"),
      ageYears: z.coerce.number().int().min(0).max(120).nullish(),
      phone: phoneField,
    })
    .optional(),
  testIds: z.array(uuid).min(1, "Select at least one test.").max(100),
  discount: money.default(0),
  overridePin: z.string().trim().max(10).optional(),
  notes: opt(500),
  payment: z
    .object({
      amount: money,
      method: z.enum(["CASH", "CARD", "JAZZCASH", "EASYPAISA", "BANK_TRANSFER", "ONLINE"]).default("CASH"),
      reference: opt(100),
    })
    .optional(),
});

export async function POST(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const parsed = await parseBody(request, createSchema);
    if (parsed.error) return parsed.error;
    const data = parsed.data;
    if (!data.patientId && !data.walkIn) return fail("Select a patient or enter walk-in patient details.", 400);
    if (data.walkIn) {
      const wName = data.walkIn.name.trim();
      if (wName && wName !== "Walk-in Customer" && (wName.length < 2 || !NAME_RE.test(wName))) {
        return fail(NAME_MESSAGE, 400);
      }
    }

    const resolved = await resolveWriteTarget(auth.ctx, data, { branchRequired: true });
    if (resolved.error) return resolved.error;
    const { organizationId, branchId } = resolved.target;

    // Every referenced record must belong to the SAME organization and branch.
    let patient = null;
    if (data.patientId) {
      patient = await prisma.patient.findFirst({ where: { id: data.patientId, organizationId, branchId }, select: { id: true, name: true } });
      if (!patient) return fail("Patient not found in this branch.", 404);
    }

    const testIds = [...new Set(data.testIds)];
    const tests = await prisma.test.findMany({
      where: { id: { in: testIds }, organizationId, isActive: true, OR: [{ branchId: null }, { branchId }] },
      include: { parameters: { orderBy: { sortOrder: "asc" } } },
    });
    if (tests.length !== testIds.length) return fail("One or more selected tests are unavailable.", 400);

    const subtotal = round2(tests.reduce((sum, t) => sum + Number(t.price), 0));
    const discount = round2(data.discount);
    if (discount > subtotal) return fail("Discount cannot exceed the order subtotal.", 400);

    const actor = auth.ctx.actor;
    const limits = actor.roleMeta;
    if (actor.role === "STAFF" && data.payment && limits?.allowedMethods?.length && !limits.allowedMethods.includes(data.payment.method)) {
      return fail(`Payment method ${data.payment.method} is not allowed for your role.`, 403);
    }
    const discountPct = subtotal > 0 ? round2((discount / subtotal) * 100) : 0;
    let overrideApprover = null;
    if (actor.role === "STAFF" && discount > 0) {
      const canDisc = hasPermission(actor.permissions, "pos.discount") || hasPermission(actor.permissions, "pos.discount_override");
      const maxPct = Number(limits?.maxDiscountPct ?? 100);
      if (!canDisc || discountPct > maxPct + 0.01) {
        overrideApprover = await verifyManagerOverride(prisma, {
          organizationId,
          branchId,
          pin: data.overridePin,
          requiredPerm: "pos.discount_override",
        });
        if (!overrideApprover) {
          return fail(
            !canDisc
              ? "Your role cannot apply discounts. Manager override PIN required."
              : `Discount (${discountPct}%) exceeds your role limit (${maxPct}%). Manager override PIN required.`,
            403,
          );
        }
      }
    }

    const total = round2(subtotal - discount);
    const initialPayment = data.payment ? round2(data.payment.amount) : 0;
    if (initialPayment > total) return fail("Payment cannot exceed the order total.", 400);

    const order = await prisma.$transaction(
      async (tx) => {
        if (!patient) {
          const w = data.walkIn;
          const wName = w.name.trim() || "Walk-in Customer";
          if (wName === "Walk-in Customer" && !w.phone && w.ageYears == null) {
            patient = await tx.patient.findFirst({
              where: { organizationId, branchId, isWalkIn: true, name: "Walk-in Customer", phone: null },
              select: { id: true, name: true },
            });
          } else if (w.phone) {
            // Reuse an existing record (same branch, same phone and name) so walk-ins never create duplicates.
            patient = await tx.patient.findFirst({
              where: { organizationId, branchId, phone: w.phone, name: { equals: wName, mode: "insensitive" } },
              select: { id: true, name: true },
            });
          }
          if (!patient) {
            const dob = w.ageYears != null ? new Date(Date.now() - w.ageYears * 365.25 * 86_400_000) : null;
            patient = await tx.patient.create({
              data: {
                organizationId, branchId, mrn: await nextNumber(tx, organizationId, "patient", "MRN"),
                name: wName, gender: w.gender, dateOfBirth: dob, phone: w.phone, isWalkIn: true,
              },
              select: { id: true, name: true },
            });
          }
        }
        const orderNo = await nextNumber(tx, organizationId, "order", "ORD");
        const types = [...new Set(tests.map((t) => t.sampleType))];

        const created = await tx.labOrder.create({
          data: {
            organizationId,
            branchId,
            orderNo,
            patientId: patient.id,
            subtotal,
            discount,
            total,
            paidAmount: initialPayment,
            paymentStatus: paymentStatusFor(total, initialPayment),
            notes: data.notes,
            createdByName: auth.ctx.actor.name,
            samples: { create: types.map((sampleType, i) => ({ sampleType, sampleNo: `${orderNo}-S${i + 1}` })) },
          },
          include: { samples: true },
        });

        for (const t of tests) {
          await tx.labOrderItem.create({
            data: {
              orderId: created.id,
              testId: t.id,
              sampleId: created.samples.find((s) => s.sampleType === t.sampleType)?.id || null,
              testName: t.name,
              testCode: t.code,
              price: t.price,
              unit: t.unit,
              // Snapshot of every parameter so later catalog edits never change old reports.
              results: {
                create: t.parameters.map((p) => ({
                  name: p.name, unit: p.unit, refLow: p.refLow, refHigh: p.refHigh, refRangeText: p.refRangeText, sortOrder: p.sortOrder,
                })),
              },
            },
          });
        }

        if (initialPayment > 0) {
          await tx.payment.create({
            data: {
              organizationId,
              branchId,
              orderId: created.id,
              amount: initialPayment,
              method: data.payment.method,
              reference: data.payment.reference,
              receivedByName: auth.ctx.actor.name,
            },
          });
        }

        if (overrideApprover) {
          await logAudit({
            tx,
            organizationId,
            branchId,
            userId: actor.id,
            actorName: actor.name,
            actorRole: actor.role,
            action: "DISCOUNT_OVERRIDE",
            resource: "LAB_ORDER",
            resourceId: created.id,
            summary: `${orderNo} discount approved by ${overrideApprover.name} (${discountPct}%)`,
            ip: clientIp(request),
          });
        }

        await notify(tx, {
          organizationId,
          branchId,
          type: "ORDER",
          title: "New laboratory order",
          message: `${orderNo} created for ${patient.name} (${tests.length} test${tests.length > 1 ? "s" : ""}).`,
          link: "/orders",
        });
        return created;
      },
      { maxWait: 10000, timeout: 30000 },
    );

    invalidateStatsCache();
    return json({ id: order.id, orderNo: order.orderNo, message: "Order created." }, 201);
  } catch (error) {
    return handleError(error, "Order create");
  }
}
