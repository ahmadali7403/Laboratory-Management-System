import { prisma } from "@/lib/prisma";
import { ADMIN_ROLE_NAMES, scopeWhere } from "@/lib/scope";
import { isUuid } from "@/lib/http";
import { PERMISSION_CATALOG } from "@/lib/permissions";

/**
 * REPORT ENGINE
 * -------------
 * Every module has a COMBINED report (all records, with totals) and an INDIVIDUAL report
 * (one patient / doctor / test / order / supplier ...). All queries are filtered by the
 * verified scope (scopeWhere), so Branch admin sees only its branch, Organization admin
 * its organization and Super admin whatever is selected (or everything).
 *
 * A report is plain data:  { title, subtitle, summary:[{label,value,kind}], tables:[{title,cols,rows}] }
 * kinds: t=text d=date dt=datetime m=money n=number s=status
 */

const LIMIT = 500;
const num = (v) => (v == null ? 0 : Number(v));
const sum = (rows, f) => rows.reduce((s, r) => s + num(f(r)), 0);
const live = { not: "CANCELLED" };
const TZ = "+05:00"; // Asia/Karachi
const ABNORMAL = ["HIGH", "LOW", "CRITICAL", "ABNORMAL"];

export function parseRange(from, to) {
  const ok = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const r = {};
  const day = {}; // @db.Date columns compare by calendar day (UTC midnight), not by Karachi instant
  if (ok(from)) { r.gte = new Date(`${from}T00:00:00${TZ}`); day.gte = new Date(`${from}T00:00:00Z`); }
  if (ok(to)) { r.lt = new Date(new Date(`${to}T00:00:00${TZ}`).getTime() + 86_400_000); day.lt = new Date(new Date(`${to}T00:00:00Z`).getTime() + 86_400_000); }
  return r.gte || r.lt ? { ...r, day } : null;
}
const inRange = (field, r) => {
  if (!r) return {};
  const { day, ...bounds } = r; // eslint-disable-line no-unused-vars
  return { [field]: bounds };
};
const inDay = (field, r) => (r ? { [field]: r.day } : {});
const rangeText = (from, to) => (from || to ? `${from || "start"} → ${to || "today"}` : "All time");
const col = (label, key, kind = "t") => ({ label, key, kind });
const T = (title, cols, rows) => ({ title, cols, rows });
const S = (label, value, kind = "n") => ({ label, value, kind });
const ageOf = (d) => (d ? Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 31_557_600_000)) : null);
const resultText = (i) => i.resultValue ?? (i.results?.length ? i.results.map((x) => `${x.name}: ${x.value ?? "—"}`).join("; ") : null);

export const REPORT_MODULES = [
  { key: "patients", title: "Patients", description: "Registrations, visits, billing per patient.", entity: "Patient", icon: "Users" },
  { key: "doctors", title: "Doctors", description: "Referrals and revenue per doctor.", entity: "Doctor", icon: "Stethoscope" },
  { key: "tests", title: "Tests", description: "Most ordered tests and test revenue.", entity: "Test", icon: "TestTube" },
  { key: "orders", title: "Orders", description: "All lab orders, discounts and balances.", entity: "Order", icon: "ClipboardList" },
  { key: "samples", title: "Samples", description: "Collected, received and rejected samples.", entity: "Sample", icon: "Droplets" },
  { key: "results", title: "Results", description: "Result status and abnormal findings.", entity: "Order (results)", icon: "FlaskConical" },
  { key: "billing", title: "Billing & Payments", description: "Collections, methods and outstanding invoices.", entity: "Invoice (order)", icon: "Receipt" },
  { key: "expenses", title: "Expenses", description: "Spending by category and payment method.", entity: "Expense category", icon: "Wallet" },
  { key: "suppliers", title: "Suppliers", description: "Purchases and dues per supplier.", entity: "Supplier", icon: "Truck" },
  { key: "purchases", title: "Purchases", description: "Purchase orders and received stock.", entity: "Purchase", icon: "ShoppingCart" },
  { key: "inventory", title: "Inventory", description: "Stock levels, value and low stock.", entity: "Inventory item", icon: "Boxes" },
  { key: "staff", title: "Staff & Roles", description: "Staff directory, roles and permissions.", entity: "Staff member", icon: "UserCog" },
  { key: "profit", title: "Profit & Loss", description: "Revenue vs expenses vs purchases, per branch.", entity: "Branch", icon: "TrendingUp" },
];

const orderCols = [
  col("Date", "createdAt", "dt"), col("Order", "orderNo"), col("Patient", "patient"), col("Doctor", "doctor"),
  col("Total", "total", "m"), col("Discount", "discount", "m"), col("Paid", "paid", "m"), col("Balance", "balance", "m"),
  col("Payment", "paymentStatus", "s"), col("Status", "status", "s"),
];
const orderRow = (o) => ({
  createdAt: o.createdAt, orderNo: o.orderNo, patient: o.patient ? `${o.patient.name} (${o.patient.mrn})` : null, doctor: o.doctor?.name || o.referredBy || null,
  total: num(o.total), discount: num(o.discount), paid: num(o.paidAmount), balance: num(o.total) - num(o.paidAmount),
  paymentStatus: o.paymentStatus, status: o.status, tests: o.items?.map((i) => i.testName).join(", "),
});
const orderInclude = { patient: { select: { name: true, mrn: true } }, doctor: { select: { name: true } }, items: { select: { testName: true } } };

/* ------------------------------------------------------------------ entity pickers */
export async function listEntities(ctx, module, q = "") {
  const { scope } = ctx;
  const base = scopeWhere(scope);
  const shared = scopeWhere(scope, { shared: true });
  const text = q.trim().slice(0, 80);
  const like = (f) => ({ [f]: { contains: text, mode: "insensitive" } });
  const take = 25;
  switch (module) {
    case "patients": {
      const rows = await prisma.patient.findMany({ where: { ...base, ...(text ? { OR: [like("name"), like("mrn"), like("phone")] } : {}) }, orderBy: { createdAt: "desc" }, take, select: { id: true, name: true, mrn: true, phone: true } });
      return rows.map((r) => ({ id: r.id, label: `${r.name} · ${r.mrn}`, hint: r.phone }));
    }
    case "doctors": {
      const rows = await prisma.doctor.findMany({ where: { AND: [shared, text ? like("name") : {}] }, orderBy: { name: "asc" }, take, select: { id: true, name: true, specialization: true } });
      return rows.map((r) => ({ id: r.id, label: r.name, hint: r.specialization }));
    }
    case "tests": {
      const rows = await prisma.test.findMany({ where: { AND: [shared, text ? { OR: [like("name"), like("code")] } : {}] }, orderBy: { name: "asc" }, take, select: { id: true, name: true, code: true } });
      return rows.map((r) => ({ id: r.id, label: `${r.name} · ${r.code}` }));
    }
    case "orders": case "results": case "billing": {
      const rows = await prisma.labOrder.findMany({ where: { ...base, ...(text ? { OR: [like("orderNo"), { patient: { name: { contains: text, mode: "insensitive" } } }] } : {}) }, orderBy: { createdAt: "desc" }, take, select: { id: true, orderNo: true, patient: { select: { name: true } } } });
      return rows.map((r) => ({ id: r.id, label: `${r.orderNo} · ${r.patient.name}` }));
    }
    case "samples": {
      const rows = await prisma.sample.findMany({ where: { order: base, ...(text ? like("sampleNo") : {}) }, orderBy: { createdAt: "desc" }, take, select: { id: true, sampleNo: true, sampleType: true, order: { select: { patient: { select: { name: true } } } } } });
      return rows.map((r) => ({ id: r.id, label: `${r.sampleNo} · ${r.sampleType}`, hint: r.order.patient.name }));
    }
    case "expenses": {
      const rows = await prisma.expense.groupBy({ by: ["category"], where: { ...base, ...(text ? like("category") : {}) }, _count: { _all: true }, orderBy: { category: "asc" }, take: 50 });
      return rows.map((r) => ({ id: r.category, label: r.category, hint: `${r._count._all} expenses` }));
    }
    case "suppliers": {
      const rows = await prisma.supplier.findMany({ where: { AND: [shared, text ? like("name") : {}] }, orderBy: { name: "asc" }, take, select: { id: true, name: true } });
      return rows.map((r) => ({ id: r.id, label: r.name }));
    }
    case "purchases": {
      const rows = await prisma.purchase.findMany({ where: { ...base, ...(text ? like("purchaseNo") : {}) }, orderBy: { purchaseDate: "desc" }, take, select: { id: true, purchaseNo: true, supplier: { select: { name: true } } } });
      return rows.map((r) => ({ id: r.id, label: r.purchaseNo, hint: r.supplier.name }));
    }
    case "inventory": {
      const rows = await prisma.inventoryItem.findMany({ where: { ...base, ...(text ? { OR: [like("name"), like("sku")] } : {}) }, orderBy: { name: "asc" }, take, select: { id: true, name: true, sku: true } });
      return rows.map((r) => ({ id: r.id, label: r.name, hint: r.sku }));
    }
    case "staff": {
      const rows = await prisma.user.findMany({ where: { ...staffWhere(scope), ...(text ? like("name") : {}) }, orderBy: { name: "asc" }, take, select: { id: true, name: true } });
      return rows.map((r) => ({ id: r.id, label: r.name }));
    }
    case "profit": {
      const rows = await prisma.branch.findMany({ where: { ...(scope.organizationId ? { organizationId: scope.organizationId } : {}), ...(scope.branchId ? { id: scope.branchId } : {}), ...(text ? like("name") : {}) }, orderBy: { name: "asc" }, take, select: { id: true, name: true, organization: { select: { name: true } } } });
      return rows.map((r) => ({ id: r.id, label: r.name, hint: scope.organizationId ? null : r.organization.name }));
    }
    default: return [];
  }
}

function staffWhere(scope) {
  return {
    ...(scope.organizationId ? { organizationId: scope.organizationId } : {}),
    ...(scope.branchId ? { memberships: { some: { branchId: scope.branchId } } } : {}),
    userRoles: { some: { role: { name: { notIn: ADMIN_ROLE_NAMES } } } },
  };
}

/* ------------------------------------------------------------------ entry point */
export async function runReport(ctx, module, { mode = "combined", id = null, from = null, to = null } = {}) {
  const range = parseRange(from, to);
  const fn = (mode === "individual" ? INDIVIDUAL : COMBINED)[module];
  if (!fn) return { error: "Unknown report.", status: 404 };
  if (mode === "individual") {
    if (!id) return { error: "Choose a record first.", status: 400 };
    if (module !== "expenses" && !isUuid(id)) return { error: "Invalid record.", status: 400 };
  }
  const report = await fn({ ...ctx, range, from, to, id: String(id || "") });
  if (!report) return { error: "Record not found.", status: 404 };
  return { report: { module, mode, period: rangeText(from, to), ...report } };
}

/* ================================================================== COMBINED */
const COMBINED = {
  async patients({ scope, range, from, to }) {
    const base = scopeWhere(scope);
    const pWhere = { ...base, ...inRange("createdAt", range) };
    const oWhere = { ...base, status: live, ...inRange("createdAt", range) };
    const [patients, total, byGender, walkIns, orders, top] = await Promise.all([
      prisma.patient.findMany({ where: pWhere, orderBy: { createdAt: "desc" }, take: LIMIT, select: { mrn: true, name: true, gender: true, dateOfBirth: true, phone: true, isWalkIn: true, createdAt: true, branch: { select: { name: true } } } }),
      prisma.patient.count({ where: pWhere }),
      prisma.patient.groupBy({ by: ["gender"], where: pWhere, _count: { _all: true } }),
      prisma.patient.count({ where: { ...pWhere, isWalkIn: true } }),
      prisma.labOrder.aggregate({ where: oWhere, _count: { _all: true }, _sum: { total: true, paidAmount: true } }),
      prisma.labOrder.groupBy({ by: ["patientId"], where: oWhere, _count: { _all: true }, _sum: { total: true, paidAmount: true }, orderBy: { _sum: { total: "desc" } }, take: 20 }),
    ]);
    const names = await prisma.patient.findMany({ where: { id: { in: top.map((t) => t.patientId) } }, select: { id: true, name: true, mrn: true } });
    const nameOf = Object.fromEntries(names.map((n) => [n.id, `${n.name} (${n.mrn})`]));
    const g = (k) => byGender.find((x) => x.gender === k)?._count._all || 0;
    return {
      title: "Patients report — combined", subtitle: rangeText(from, to),
      summary: [S("Patients registered", total), S("Walk-in patients", walkIns), S("Male", g("MALE")), S("Female", g("FEMALE")), S("Other", g("OTHER")), S("Visits (orders)", orders._count._all), S("Total billed", num(orders._sum.total), "m"), S("Total collected", num(orders._sum.paidAmount), "m")],
      tables: [
        T("Top patients by billing", [col("Patient", "patient"), col("Visits", "visits", "n"), col("Billed", "billed", "m"), col("Paid", "paid", "m"), col("Outstanding", "due", "m")],
          top.map((t) => ({ patient: nameOf[t.patientId], visits: t._count._all, billed: num(t._sum.total), paid: num(t._sum.paidAmount), due: num(t._sum.total) - num(t._sum.paidAmount) }))),
        T(`Patients registered${total > LIMIT ? ` (latest ${LIMIT} of ${total})` : ""}`, [col("MRN", "mrn"), col("Name", "name"), col("Gender", "gender"), col("Age", "age", "n"), col("Phone", "phone"), col("Branch", "branch"), col("Type", "type"), col("Registered", "createdAt", "dt")],
          patients.map((p) => ({ ...p, age: ageOf(p.dateOfBirth), branch: p.branch.name, type: p.isWalkIn ? "Walk-in" : "Registered" }))),
      ],
    };
  },

  async doctors({ scope, range, from, to }) {
    const shared = scopeWhere(scope, { shared: true });
    const oWhere = { ...scopeWhere(scope), status: live, ...inRange("createdAt", range) };
    const [doctors, grouped] = await Promise.all([
      prisma.doctor.findMany({ where: shared, orderBy: { name: "asc" }, take: LIMIT, select: { id: true, name: true, specialization: true, phone: true, isActive: true } }),
      prisma.labOrder.groupBy({ by: ["doctorId"], where: oWhere, _count: { _all: true }, _sum: { total: true, paidAmount: true } }),
    ]);
    const by = Object.fromEntries(grouped.map((x) => [x.doctorId || "none", x]));
    const rows = doctors.map((d) => ({ name: d.name, specialization: d.specialization, phone: d.phone, active: d.isActive ? "ACTIVE" : "INACTIVE", orders: by[d.id]?._count._all || 0, billed: num(by[d.id]?._sum.total), paid: num(by[d.id]?._sum.paidAmount) })).sort((a, b) => b.billed - a.billed);
    const none = by.none;
    return {
      title: "Doctors report — combined", subtitle: rangeText(from, to),
      summary: [S("Doctors", doctors.length), S("Active", doctors.filter((d) => d.isActive).length), S("Referred orders", sum(rows, (r) => r.orders)), S("Referral revenue (billed)", sum(rows, (r) => r.billed), "m"), S("Orders without a doctor", none?._count._all || 0)],
      tables: [T("Referrals per doctor", [col("Doctor", "name"), col("Specialization", "specialization"), col("Phone", "phone"), col("Status", "active", "s"), col("Orders", "orders", "n"), col("Billed", "billed", "m"), col("Collected", "paid", "m")], rows)],
    };
  },

  async tests({ scope, range, from, to }) {
    const shared = scopeWhere(scope, { shared: true });
    const iWhere = { order: { ...scopeWhere(scope), status: live, ...inRange("createdAt", range) } };
    const [tests, grouped, abn] = await Promise.all([
      prisma.test.findMany({ where: shared, select: { id: true, name: true, code: true, category: true, price: true, isActive: true }, take: 1000 }),
      prisma.labOrderItem.groupBy({ by: ["testId"], where: iWhere, _count: { _all: true }, _sum: { price: true } }),
      prisma.labOrderItem.groupBy({ by: ["testId"], where: { ...iWhere, flag: { in: ABNORMAL } }, _count: { _all: true } }),
    ]);
    const by = Object.fromEntries(grouped.map((x) => [x.testId, x]));
    const ab = Object.fromEntries(abn.map((x) => [x.testId, x._count._all]));
    const rows = tests.map((t) => ({ name: t.name, code: t.code, category: t.category, price: num(t.price), active: t.isActive ? "ACTIVE" : "INACTIVE", count: by[t.id]?._count._all || 0, revenue: num(by[t.id]?._sum.price), abnormal: ab[t.id] || 0 })).sort((a, b) => b.count - a.count);
    return {
      title: "Tests report — combined", subtitle: rangeText(from, to),
      summary: [S("Tests in catalog", tests.length), S("Active tests", tests.filter((t) => t.isActive).length), S("Tests performed", sum(rows, (r) => r.count)), S("Test revenue", sum(rows, (r) => r.revenue), "m"), S("Abnormal results", sum(rows, (r) => r.abnormal))],
      tables: [T("Tests by demand", [col("Test", "name"), col("Code", "code"), col("Category", "category"), col("Price", "price", "m"), col("Status", "active", "s"), col("Times ordered", "count", "n"), col("Revenue", "revenue", "m"), col("Abnormal", "abnormal", "n")], rows)],
    };
  },

  async orders({ scope, range, from, to }) {
    const where = { ...scopeWhere(scope), ...inRange("createdAt", range) };
    const [orders, total, byStatus] = await Promise.all([
      prisma.labOrder.findMany({ where, orderBy: { createdAt: "desc" }, take: LIMIT, include: orderInclude }),
      prisma.labOrder.count({ where }),
      prisma.labOrder.groupBy({ by: ["status"], where, _count: { _all: true }, _sum: { total: true } }),
    ]);
    const liveRows = await prisma.labOrder.aggregate({ where: { ...where, status: live }, _sum: { total: true, discount: true, paidAmount: true, subtotal: true } });
    const billed = num(liveRows._sum.total), paid = num(liveRows._sum.paidAmount);
    return {
      title: "Orders report — combined", subtitle: rangeText(from, to),
      summary: [S("Orders", total), S("Completed", byStatus.find((x) => x.status === "COMPLETED")?._count._all || 0), S("Cancelled", byStatus.find((x) => x.status === "CANCELLED")?._count._all || 0), S("Billed (excl. cancelled)", billed, "m"), S("Discounts", num(liveRows._sum.discount), "m"), S("Collected", paid, "m"), S("Outstanding", billed - paid, "m")],
      tables: [
        T("Orders by status", [col("Status", "status", "s"), col("Orders", "count", "n"), col("Value", "value", "m")], byStatus.map((x) => ({ status: x.status, count: x._count._all, value: num(x._sum.total) }))),
        T(`Orders${total > LIMIT ? ` (latest ${LIMIT} of ${total})` : ""}`, orderCols, orders.map(orderRow)),
      ],
    };
  },

  async samples({ scope, range, from, to }) {
    const where = { order: scopeWhere(scope), ...inRange("createdAt", range) };
    const [samples, byStatus, total] = await Promise.all([
      prisma.sample.findMany({ where, orderBy: { createdAt: "desc" }, take: LIMIT, select: { sampleNo: true, sampleType: true, status: true, collectedAt: true, collectedByName: true, rejectionReason: true, createdAt: true, order: { select: { orderNo: true, patient: { select: { name: true } } } } } }),
      prisma.sample.groupBy({ by: ["status"], where, _count: { _all: true } }),
      prisma.sample.count({ where }),
    ]);
    const c = (s) => byStatus.find((x) => x.status === s)?._count._all || 0;
    return {
      title: "Samples report — combined", subtitle: rangeText(from, to),
      summary: [S("Samples", total), S("Pending", c("PENDING")), S("Collected", c("COLLECTED")), S("Received", c("RECEIVED")), S("Rejected", c("REJECTED"))],
      tables: [T(`Samples${total > LIMIT ? ` (latest ${LIMIT} of ${total})` : ""}`, [col("Created", "createdAt", "dt"), col("Sample", "sampleNo"), col("Type", "sampleType"), col("Order", "orderNo"), col("Patient", "patient"), col("Status", "status", "s"), col("Collected at", "collectedAt", "dt"), col("Collected by", "collectedByName"), col("Rejection reason", "rejectionReason")],
        samples.map((s) => ({ ...s, orderNo: s.order.orderNo, patient: s.order.patient.name })))],
    };
  },

  async results({ scope, range, from, to }) {
    const where = { order: { ...scopeWhere(scope), status: live }, ...inRange("createdAt", range) };
    const [items, total, byStatus, byFlag] = await Promise.all([
      prisma.labOrderItem.findMany({ where, orderBy: { createdAt: "desc" }, take: LIMIT, include: { order: { select: { orderNo: true, patient: { select: { name: true, mrn: true } } } }, results: { orderBy: { sortOrder: "asc" }, select: { name: true, value: true } } } }),
      prisma.labOrderItem.count({ where }),
      prisma.labOrderItem.groupBy({ by: ["resultStatus"], where, _count: { _all: true } }),
      prisma.labOrderItem.groupBy({ by: ["flag"], where: { ...where, resultStatus: { not: "PENDING" } }, _count: { _all: true } }),
    ]);
    const s = (k) => byStatus.find((x) => x.resultStatus === k)?._count._all || 0;
    const abnormal = byFlag.filter((x) => ABNORMAL.includes(x.flag)).reduce((a, x) => a + x._count._all, 0);
    return {
      title: "Results report — combined", subtitle: rangeText(from, to),
      summary: [S("Tests ordered", total), S("Pending", s("PENDING")), S("Entered", s("ENTERED")), S("Verified", s("VERIFIED")), S("Abnormal results", abnormal)],
      tables: [
        T("Result flags", [col("Flag", "flag", "s"), col("Tests", "count", "n")], byFlag.map((x) => ({ flag: x.flag, count: x._count._all }))),
        T(`Results${total > LIMIT ? ` (latest ${LIMIT} of ${total})` : ""}`, [col("Date", "createdAt", "dt"), col("Order", "orderNo"), col("Patient", "patient"), col("Test", "testName"), col("Result", "result"), col("Unit", "unit"), col("Flag", "flag", "s"), col("Status", "resultStatus", "s"), col("Entered by", "enteredByName"), col("Verified by", "verifiedByName")],
          items.map((i) => ({ ...i, orderNo: i.order.orderNo, patient: `${i.order.patient.name} (${i.order.patient.mrn})`, result: resultText(i) }))),
      ],
    };
  },

  async billing({ scope, range, from, to }) {
    const base = scopeWhere(scope);
    const pWhere = { ...base, ...inRange("createdAt", range) };
    const oWhere = { ...base, status: live, ...inRange("createdAt", range) };
    const [payments, total, byMethod, invoiced, unpaid] = await Promise.all([
      prisma.payment.findMany({ where: pWhere, orderBy: { createdAt: "desc" }, take: LIMIT, include: { order: { select: { orderNo: true, patient: { select: { name: true } } } } } }),
      prisma.payment.aggregate({ where: pWhere, _sum: { amount: true }, _count: { _all: true } }),
      prisma.payment.groupBy({ by: ["method"], where: pWhere, _sum: { amount: true }, _count: { _all: true } }),
      prisma.labOrder.aggregate({ where: oWhere, _sum: { total: true, discount: true }, _count: { _all: true } }),
      prisma.labOrder.findMany({ where: { ...oWhere, paymentStatus: { in: ["UNPAID", "PARTIAL"] } }, orderBy: { createdAt: "desc" }, take: 200, include: orderInclude }),
    ]);
    const billed = num(invoiced._sum.total), collected = num(total._sum.amount);
    return {
      title: "Billing & payments report — combined", subtitle: rangeText(from, to),
      summary: [S("Invoices", invoiced._count._all), S("Billed", billed, "m"), S("Discounts", num(invoiced._sum.discount), "m"), S("Payments received", collected, "m"), S("Payment count", total._count._all), S("Unpaid / partial invoices", unpaid.length)],
      tables: [
        T("Collections by method", [col("Method", "method", "s"), col("Payments", "count", "n"), col("Amount", "amount", "m")], byMethod.map((x) => ({ method: x.method, count: x._count._all, amount: num(x._sum.amount) }))),
        T("Outstanding invoices", orderCols, unpaid.map(orderRow)),
        T(`Payments${total._count._all > LIMIT ? ` (latest ${LIMIT})` : ""}`, [col("Date", "createdAt", "dt"), col("Order", "orderNo"), col("Patient", "patient"), col("Amount", "amount", "m"), col("Method", "method", "s"), col("Reference", "reference"), col("Received by", "receivedByName")],
          payments.map((p) => ({ ...p, amount: num(p.amount), orderNo: p.order.orderNo, patient: p.order.patient.name }))),
      ],
    };
  },

  async expenses({ scope, range, from, to }) {
    const where = { ...scopeWhere(scope), ...inDay("expenseDate", range) };
    const [rows, agg, byCat, byMethod] = await Promise.all([
      prisma.expense.findMany({ where, orderBy: { expenseDate: "desc" }, take: LIMIT, include: { branch: { select: { name: true } } } }),
      prisma.expense.aggregate({ where, _sum: { amount: true }, _count: { _all: true }, _avg: { amount: true }, _max: { amount: true } }),
      prisma.expense.groupBy({ by: ["category"], where, _sum: { amount: true }, _count: { _all: true }, orderBy: { _sum: { amount: "desc" } } }),
      prisma.expense.groupBy({ by: ["paymentMethod"], where, _sum: { amount: true }, _count: { _all: true } }),
    ]);
    return {
      title: "Expenses report — combined", subtitle: rangeText(from, to),
      summary: [S("Total expenses", num(agg._sum.amount), "m"), S("Entries", agg._count._all), S("Average", num(agg._avg.amount), "m"), S("Largest", num(agg._max.amount), "m")],
      tables: [
        T("By category", [col("Category", "category"), col("Entries", "count", "n"), col("Amount", "amount", "m")], byCat.map((x) => ({ category: x.category, count: x._count._all, amount: num(x._sum.amount) }))),
        T("By payment method", [col("Method", "method", "s"), col("Entries", "count", "n"), col("Amount", "amount", "m")], byMethod.map((x) => ({ method: x.paymentMethod, count: x._count._all, amount: num(x._sum.amount) }))),
        T(`Expenses${agg._count._all > LIMIT ? ` (latest ${LIMIT})` : ""}`, [col("Date", "expenseDate", "d"), col("Category", "category"), col("Description", "description"), col("Amount", "amount", "m"), col("Method", "paymentMethod", "s"), col("Branch", "branch"), col("Added by", "createdByName")],
          rows.map((e) => ({ ...e, amount: num(e.amount), branch: e.branch.name }))),
      ],
    };
  },

  async suppliers({ scope, range, from, to }) {
    const pWhere = { ...scopeWhere(scope), ...inDay("purchaseDate", range), status: live };
    const [suppliers, grouped] = await Promise.all([
      prisma.supplier.findMany({ where: scopeWhere(scope, { shared: true }), orderBy: { name: "asc" }, take: LIMIT, select: { id: true, name: true, contactPerson: true, phone: true, isActive: true } }),
      prisma.purchase.groupBy({ by: ["supplierId", "status"], where: pWhere, _count: { _all: true }, _sum: { total: true } }),
    ]);
    const rows = suppliers.map((s) => {
      const mine = grouped.filter((g) => g.supplierId === s.id);
      const rec = mine.find((g) => g.status === "RECEIVED"), ord = mine.find((g) => g.status === "ORDERED");
      return { name: s.name, contactPerson: s.contactPerson, phone: s.phone, active: s.isActive ? "ACTIVE" : "INACTIVE", purchases: sum(mine, (g) => g._count._all), total: sum(mine, (g) => g._sum.total), received: num(rec?._sum.total), pending: num(ord?._sum.total) };
    }).sort((a, b) => b.total - a.total);
    return {
      title: "Suppliers report — combined", subtitle: rangeText(from, to),
      summary: [S("Suppliers", suppliers.length), S("Active", suppliers.filter((s) => s.isActive).length), S("Purchases", sum(rows, (r) => r.purchases)), S("Total purchased", sum(rows, (r) => r.total), "m"), S("Received", sum(rows, (r) => r.received), "m"), S("Pending delivery", sum(rows, (r) => r.pending), "m")],
      tables: [T("Purchases per supplier", [col("Supplier", "name"), col("Contact", "contactPerson"), col("Phone", "phone"), col("Status", "active", "s"), col("Purchases", "purchases", "n"), col("Total", "total", "m"), col("Received", "received", "m"), col("Pending", "pending", "m")], rows)],
    };
  },

  async purchases({ scope, range, from, to }) {
    const where = { ...scopeWhere(scope), ...inDay("purchaseDate", range) };
    const [rows, byStatus, total] = await Promise.all([
      prisma.purchase.findMany({ where, orderBy: { purchaseDate: "desc" }, take: LIMIT, include: { supplier: { select: { name: true } }, branch: { select: { name: true } }, _count: { select: { items: true } } } }),
      prisma.purchase.groupBy({ by: ["status"], where, _count: { _all: true }, _sum: { total: true } }),
      prisma.purchase.count({ where }),
    ]);
    const v = (s) => num(byStatus.find((x) => x.status === s)?._sum.total);
    return {
      title: "Purchases report — combined", subtitle: rangeText(from, to),
      summary: [S("Purchases", total), S("Received value", v("RECEIVED"), "m"), S("Ordered (pending) value", v("ORDERED"), "m"), S("Cancelled value", v("CANCELLED"), "m")],
      tables: [
        T("By status", [col("Status", "status", "s"), col("Purchases", "count", "n"), col("Value", "value", "m")], byStatus.map((x) => ({ status: x.status, count: x._count._all, value: num(x._sum.total) }))),
        T(`Purchases${total > LIMIT ? ` (latest ${LIMIT})` : ""}`, [col("Date", "purchaseDate", "d"), col("Purchase", "purchaseNo"), col("Supplier", "supplier"), col("Branch", "branch"), col("Items", "items", "n"), col("Total", "total", "m"), col("Status", "status", "s")],
          rows.map((p) => ({ ...p, supplier: p.supplier.name, branch: p.branch.name, items: p._count.items, total: num(p.total) }))),
      ],
    };
  },

  async inventory({ scope, range, from, to }) {
    const where = scopeWhere(scope);
    const [items, bought] = await Promise.all([
      prisma.inventoryItem.findMany({ where, orderBy: { name: "asc" }, take: 1000, include: { branch: { select: { name: true } } } }),
      prisma.purchaseItem.groupBy({ by: ["inventoryItemId"], where: { purchase: { ...where, status: "RECEIVED", ...inDay("purchaseDate", range) } }, _sum: { quantity: true } }),
    ]);
    const boughtBy = Object.fromEntries(bought.map((b) => [b.inventoryItemId, num(b._sum.quantity)]));
    const status = (i) => (num(i.quantity) <= 0 ? "OUT OF STOCK" : num(i.reorderLevel) > 0 && num(i.quantity) <= num(i.reorderLevel) ? "LOW STOCK" : "NORMAL");
    const rows = items.map((i) => ({ name: i.name, sku: i.sku, branch: i.branch.name, quantity: num(i.quantity), unit: i.unit, reorder: num(i.reorderLevel), stock: status(i), cost: num(i.unitCost), value: num(i.quantity) * num(i.unitCost), bought: boughtBy[i.id] || 0 }));
    return {
      title: "Inventory report — combined", subtitle: `Stock now · purchases ${rangeText(from, to)}`,
      summary: [S("Items", rows.length), S("Low stock", rows.filter((r) => r.stock === "LOW STOCK").length), S("Out of stock", rows.filter((r) => r.stock === "OUT OF STOCK").length), S("Stock value", sum(rows, (r) => r.value), "m")],
      tables: [T("Stock", [col("Item", "name"), col("SKU", "sku"), col("Branch", "branch"), col("Quantity", "quantity", "n"), col("Unit", "unit"), col("Reorder level", "reorder", "n"), col("Stock status", "stock", "s"), col("Unit cost", "cost", "m"), col("Value", "value", "m"), col("Received in period", "bought", "n")], rows)],
    };
  },

  async staff({ scope }) {
    const users = await prisma.user.findMany({ where: staffWhere(scope), orderBy: { name: "asc" }, take: LIMIT, select: { name: true, phone: true, email: true, status: true, createdAt: true, userRoles: { select: { role: { select: { name: true } } } }, memberships: { select: { branch: { select: { name: true } } } } } });
    const rows = users.map((u) => ({ name: u.name, role: u.userRoles.map((r) => r.role.name).filter((n) => !ADMIN_ROLE_NAMES.includes(n)).join(", "), branch: u.memberships.map((m) => m.branch.name).join(", "), phone: u.phone, status: u.status, createdAt: u.createdAt }));
    const roles = {};
    rows.forEach((r) => { roles[r.role || "—"] = (roles[r.role || "—"] || 0) + 1; });
    return {
      title: "Staff report — combined", subtitle: "Current staff directory",
      summary: [S("Staff", rows.length), S("Active", rows.filter((r) => r.status === "ACTIVE").length), S("Inactive", rows.filter((r) => r.status !== "ACTIVE").length), S("Roles in use", Object.keys(roles).length)],
      tables: [
        T("Staff per role", [col("Role", "role"), col("Staff", "count", "n")], Object.entries(roles).map(([role, count]) => ({ role, count }))),
        T("Staff", [col("Name", "name"), col("Role", "role"), col("Branch", "branch"), col("Phone", "phone"), col("Status", "status", "s"), col("Joined", "createdAt", "d")], rows),
      ],
    };
  },

  async profit({ scope, range, from, to }) {
    return profitReport(scope, range, from, to, "Profit & loss — combined");
  },
};

async function profitReport(scope, range, from, to, title) {
  const base = scopeWhere(scope);
  const [pay, exp, pur, billed, branches] = await Promise.all([
    prisma.payment.groupBy({ by: ["branchId"], where: { ...base, ...inRange("createdAt", range) }, _sum: { amount: true } }),
    prisma.expense.groupBy({ by: ["branchId"], where: { ...base, ...inDay("expenseDate", range) }, _sum: { amount: true } }),
    prisma.purchase.groupBy({ by: ["branchId"], where: { ...base, status: { not: "CANCELLED" }, ...inDay("purchaseDate", range) }, _sum: { total: true } }),
    prisma.labOrder.groupBy({ by: ["branchId"], where: { ...base, status: live, ...inRange("createdAt", range) }, _sum: { total: true }, _count: { _all: true } }),
    prisma.branch.findMany({ where: { ...(scope.organizationId ? { organizationId: scope.organizationId } : {}), ...(scope.branchId ? { id: scope.branchId } : {}) }, select: { id: true, name: true, organization: { select: { name: true } } }, orderBy: { name: "asc" }, take: 1000 }),
  ]);
  const get = (arr, id, f) => num(arr.find((x) => x.branchId === id)?.[f[0]]?.[f[1]]);
  const rows = branches.map((b) => {
    const revenue = get(pay, b.id, ["_sum", "amount"]), expenses = get(exp, b.id, ["_sum", "amount"]), purchases = get(pur, b.id, ["_sum", "total"]);
    return { branch: b.name, organization: b.organization.name, orders: billed.find((x) => x.branchId === b.id)?._count._all || 0, billed: get(billed, b.id, ["_sum", "total"]), revenue, expenses, purchases, net: revenue - expenses - purchases };
  }).filter((r) => r.orders || r.revenue || r.expenses || r.purchases || branches.length === 1);
  const revenue = sum(rows, (r) => r.revenue), expenses = sum(rows, (r) => r.expenses), purchases = sum(rows, (r) => r.purchases);
  return {
    title, subtitle: rangeText(from, to),
    summary: [S("Billed", sum(rows, (r) => r.billed), "m"), S("Revenue (payments received)", revenue, "m"), S("Expenses", expenses, "m"), S("Purchases", purchases, "m"), S("Net (revenue − expenses − purchases)", revenue - expenses - purchases, "m")],
    tables: [T("By branch", [col("Branch", "branch"), ...(scope.organizationId ? [] : [col("Organization", "organization")]), col("Orders", "orders", "n"), col("Billed", "billed", "m"), col("Revenue", "revenue", "m"), col("Expenses", "expenses", "m"), col("Purchases", "purchases", "m"), col("Net", "net", "m")], rows)],
  };
}

/* ================================================================== INDIVIDUAL */
const orderDetail = (o) => ({
  summary: [S("Order", o.orderNo, "t"), S("Status", o.status, "s"), S("Subtotal", num(o.subtotal), "m"), S("Discount", num(o.discount), "m"), S("Total", num(o.total), "m"), S("Paid", num(o.paidAmount), "m"), S("Balance", num(o.total) - num(o.paidAmount), "m"), S("Payment", o.paymentStatus, "s")],
  tables: [
    T("Tests", [col("Test", "testName"), col("Code", "testCode"), col("Price", "price", "m"), col("Result", "result"), col("Unit", "unit"), col("Reference", "refRange"), col("Flag", "flag", "s"), col("Status", "resultStatus", "s")], o.items.map((i) => ({ ...i, price: num(i.price), result: resultText(i) }))),
    T("Payments", [col("Date", "createdAt", "dt"), col("Amount", "amount", "m"), col("Method", "method", "s"), col("Reference", "reference"), col("Received by", "receivedByName")], o.payments.map((p) => ({ ...p, amount: num(p.amount) }))),
  ],
});
const fullOrder = { patient: { select: { name: true, mrn: true, phone: true } }, doctor: { select: { name: true } }, items: { include: { results: { orderBy: { sortOrder: "asc" }, select: { name: true, value: true } } } }, payments: { orderBy: { createdAt: "desc" } } };

const INDIVIDUAL = {
  async patients({ scope, range, id, from, to }) {
    const p = await prisma.patient.findFirst({ where: { id, ...scopeWhere(scope) }, include: { branch: { select: { name: true } } } });
    if (!p) return null;
    const orders = await prisma.labOrder.findMany({ where: { patientId: id, ...scopeWhere(scope), ...inRange("createdAt", range) }, orderBy: { createdAt: "desc" }, take: LIMIT, include: { ...orderInclude, payments: { orderBy: { createdAt: "desc" } }, items: { include: { results: { orderBy: { sortOrder: "asc" }, select: { name: true, value: true } } } } } });
    const liveOrders = orders.filter((o) => o.status !== "CANCELLED");
    const billed = sum(liveOrders, (o) => o.total), paid = sum(liveOrders, (o) => o.paidAmount);
    return {
      title: `Patient report — ${p.name}`, subtitle: `${p.mrn} · ${p.gender}${p.dateOfBirth ? ` · ${ageOf(p.dateOfBirth)} yrs` : ""}${p.phone ? ` · ${p.phone}` : ""} · ${p.branch.name} · ${rangeText(from, to)}`,
      summary: [S("Visits (orders)", liveOrders.length), S("Total billed", billed, "m"), S("Total paid", paid, "m"), S("Outstanding", billed - paid, "m"), S("Discounts", sum(liveOrders, (o) => o.discount), "m")],
      tables: [
        T("Orders", orderCols, orders.map(orderRow)),
        T("Test results", [col("Date", "date", "dt"), col("Order", "orderNo"), col("Test", "testName"), col("Result", "result"), col("Unit", "unit"), col("Reference", "refRange"), col("Flag", "flag", "s"), col("Status", "resultStatus", "s")],
          orders.flatMap((o) => o.items.map((i) => ({ ...i, date: o.createdAt, orderNo: o.orderNo, result: resultText(i) })))),
        T("Payments", [col("Date", "createdAt", "dt"), col("Order", "orderNo"), col("Amount", "amount", "m"), col("Method", "method", "s"), col("Reference", "reference")], orders.flatMap((o) => o.payments.map((x) => ({ ...x, amount: num(x.amount), orderNo: o.orderNo })))),
      ],
    };
  },

  async doctors({ scope, range, id, from, to }) {
    const d = await prisma.doctor.findFirst({ where: { id, ...scopeWhere(scope, { shared: true }) } });
    if (!d) return null;
    const orders = await prisma.labOrder.findMany({ where: { doctorId: id, ...scopeWhere(scope), ...inRange("createdAt", range) }, orderBy: { createdAt: "desc" }, take: LIMIT, include: orderInclude });
    const liveOrders = orders.filter((o) => o.status !== "CANCELLED");
    return {
      title: `Doctor report — ${d.name}`, subtitle: `${d.specialization || "—"}${d.phone ? ` · ${d.phone}` : ""} · ${rangeText(from, to)}`,
      summary: [S("Referred orders", liveOrders.length), S("Billed", sum(liveOrders, (o) => o.total), "m"), S("Collected", sum(liveOrders, (o) => o.paidAmount), "m"), S("Outstanding", sum(liveOrders, (o) => num(o.total) - num(o.paidAmount)), "m")],
      tables: [T("Referred orders", [...orderCols, col("Tests", "tests")], orders.map(orderRow))],
    };
  },

  async tests({ scope, range, id, from, to }) {
    const t = await prisma.test.findFirst({ where: { id, ...scopeWhere(scope, { shared: true }) }, include: { parameters: { orderBy: { sortOrder: "asc" } } } });
    if (!t) return null;
    const items = await prisma.labOrderItem.findMany({ where: { testId: id, order: { ...scopeWhere(scope), status: live, ...inRange("createdAt", range) } }, orderBy: { createdAt: "desc" }, take: LIMIT, include: { order: { select: { orderNo: true, createdAt: true, patient: { select: { name: true, mrn: true } } } }, results: { orderBy: { sortOrder: "asc" }, select: { name: true, value: true } } } });
    return {
      title: `Test report — ${t.name}`, subtitle: `${t.code}${t.category ? ` · ${t.category}` : ""} · Rs ${num(t.price)} · ${rangeText(from, to)}`,
      summary: [S("Times ordered", items.length), S("Revenue", sum(items, (i) => i.price), "m"), S("Abnormal results", items.filter((i) => ABNORMAL.includes(i.flag)).length), S("Pending results", items.filter((i) => i.resultStatus === "PENDING").length)],
      tables: [
        T("Orders containing this test", [col("Date", "date", "dt"), col("Order", "orderNo"), col("Patient", "patient"), col("Price", "price", "m"), col("Result", "result"), col("Flag", "flag", "s"), col("Status", "resultStatus", "s")],
          items.map((i) => ({ ...i, date: i.order.createdAt, orderNo: i.order.orderNo, patient: `${i.order.patient.name} (${i.order.patient.mrn})`, price: num(i.price), result: resultText(i) }))),
        T("Parameters", [col("Parameter", "name"), col("Unit", "unit"), col("Low", "refLow", "n"), col("High", "refHigh", "n"), col("Text range", "refRangeText")], t.parameters.map((p) => ({ ...p, refLow: p.refLow == null ? null : num(p.refLow), refHigh: p.refHigh == null ? null : num(p.refHigh) }))),
      ],
    };
  },

  async orders({ scope, id }) {
    const o = await prisma.labOrder.findFirst({ where: { id, ...scopeWhere(scope) }, include: fullOrder });
    if (!o) return null;
    return { title: `Order report — ${o.orderNo}`, subtitle: `${o.patient.name} (${o.patient.mrn})${o.doctor ? ` · Dr. ${o.doctor.name}` : ""}`, ...orderDetail(o) };
  },
  async results({ scope, id }) {
    const o = await prisma.labOrder.findFirst({ where: { id, ...scopeWhere(scope) }, include: fullOrder });
    if (!o) return null;
    const d = orderDetail(o);
    return { title: `Results report — ${o.orderNo}`, subtitle: `${o.patient.name} (${o.patient.mrn})`, summary: [S("Tests", o.items.length), S("Verified", o.items.filter((i) => i.resultStatus === "VERIFIED").length), S("Abnormal", o.items.filter((i) => ABNORMAL.includes(i.flag)).length)], tables: [d.tables[0], T("Parameter values", [col("Test", "test"), col("Parameter", "name"), col("Value", "value"), col("Unit", "unit"), col("Flag", "flag", "s")], o.items.flatMap((i) => i.results.length ? i.results.map((r) => ({ test: i.testName, name: r.name, value: r.value, unit: null, flag: i.flag })) : []))] };
  },
  async billing({ scope, id }) {
    const o = await prisma.labOrder.findFirst({ where: { id, ...scopeWhere(scope) }, include: fullOrder });
    if (!o) return null;
    const d = orderDetail(o);
    return { title: `Invoice report — ${o.orderNo}`, subtitle: `${o.patient.name} (${o.patient.mrn})`, summary: d.summary, tables: [d.tables[1], T("Invoice lines", [col("Test", "testName"), col("Code", "testCode"), col("Price", "price", "m")], o.items.map((i) => ({ ...i, price: num(i.price) })))] };
  },

  async samples({ scope, id }) {
    const s = await prisma.sample.findFirst({ where: { id, order: scopeWhere(scope) }, include: { order: { select: { orderNo: true, patient: { select: { name: true, mrn: true } } } }, items: { select: { testName: true, testCode: true, resultStatus: true } } } });
    if (!s) return null;
    return {
      title: `Sample report — ${s.sampleNo}`, subtitle: `${s.sampleType} · Order ${s.order.orderNo} · ${s.order.patient.name} (${s.order.patient.mrn})`,
      summary: [S("Status", s.status, "s"), S("Collected at", s.collectedAt, "dt"), S("Collected by", s.collectedByName || "—", "t"), S("Rejection reason", s.rejectionReason || "—", "t")],
      tables: [T("Tests on this sample", [col("Test", "testName"), col("Code", "testCode"), col("Result status", "resultStatus", "s")], s.items)],
    };
  },

  async expenses({ scope, range, id, from, to }) {
    const where = { ...scopeWhere(scope), category: id, ...inDay("expenseDate", range) };
    const rows = await prisma.expense.findMany({ where, orderBy: { expenseDate: "desc" }, take: LIMIT, include: { branch: { select: { name: true } } } });
    if (!rows.length && !range) return null;
    const total = sum(rows, (e) => e.amount);
    return {
      title: `Expense report — ${id}`, subtitle: rangeText(from, to),
      summary: [S("Total", total, "m"), S("Entries", rows.length), S("Average", rows.length ? total / rows.length : 0, "m"), S("Largest", Math.max(0, ...rows.map((e) => num(e.amount))), "m")],
      tables: [T("Expenses", [col("Date", "expenseDate", "d"), col("Description", "description"), col("Amount", "amount", "m"), col("Method", "paymentMethod", "s"), col("Branch", "branch"), col("Added by", "createdByName")], rows.map((e) => ({ ...e, amount: num(e.amount), branch: e.branch.name })))],
    };
  },

  async suppliers({ scope, range, id, from, to }) {
    const s = await prisma.supplier.findFirst({ where: { id, ...scopeWhere(scope, { shared: true }) } });
    if (!s) return null;
    const purchases = await prisma.purchase.findMany({ where: { supplierId: id, ...scopeWhere(scope), ...inDay("purchaseDate", range) }, orderBy: { purchaseDate: "desc" }, take: LIMIT, include: { branch: { select: { name: true } }, items: { include: { inventoryItem: { select: { name: true } } } } } });
    const ok = purchases.filter((p) => p.status !== "CANCELLED");
    return {
      title: `Supplier report — ${s.name}`, subtitle: `${s.contactPerson || "—"}${s.phone ? ` · ${s.phone}` : ""} · ${rangeText(from, to)}`,
      summary: [S("Purchases", ok.length), S("Total purchased", sum(ok, (p) => p.total), "m"), S("Received", sum(ok.filter((p) => p.status === "RECEIVED"), (p) => p.total), "m"), S("Pending delivery", sum(ok.filter((p) => p.status === "ORDERED"), (p) => p.total), "m")],
      tables: [
        T("Purchases", [col("Date", "purchaseDate", "d"), col("Purchase", "purchaseNo"), col("Branch", "branch"), col("Total", "total", "m"), col("Status", "status", "s")], purchases.map((p) => ({ ...p, total: num(p.total), branch: p.branch.name }))),
        T("Items bought", [col("Date", "date", "d"), col("Item", "item"), col("Quantity", "quantity", "n"), col("Unit cost", "unitCost", "m")], purchases.flatMap((p) => p.items.map((i) => ({ date: p.purchaseDate, item: i.inventoryItem.name, quantity: num(i.quantity), unitCost: num(i.unitCost) })))),
      ],
    };
  },

  async purchases({ scope, id }) {
    const p = await prisma.purchase.findFirst({ where: { id, ...scopeWhere(scope) }, include: { supplier: { select: { name: true } }, branch: { select: { name: true } }, items: { include: { inventoryItem: { select: { name: true, unit: true } } } } } });
    if (!p) return null;
    return {
      title: `Purchase report — ${p.purchaseNo}`, subtitle: `${p.supplier.name} · ${p.branch.name}`,
      summary: [S("Date", p.purchaseDate, "d"), S("Status", p.status, "s"), S("Items", p.items.length), S("Total", num(p.total), "m"), S("Created by", p.createdByName, "t")],
      tables: [T("Items", [col("Item", "item"), col("Quantity", "quantity", "n"), col("Unit", "unit"), col("Unit cost", "unitCost", "m"), col("Line total", "line", "m")], p.items.map((i) => ({ item: i.inventoryItem.name, quantity: num(i.quantity), unit: i.inventoryItem.unit, unitCost: num(i.unitCost), line: num(i.quantity) * num(i.unitCost) })))],
    };
  },

  async inventory({ scope, range, id, from, to }) {
    const i = await prisma.inventoryItem.findFirst({ where: { id, ...scopeWhere(scope) }, include: { branch: { select: { name: true } } } });
    if (!i) return null;
    const bought = await prisma.purchaseItem.findMany({ where: { inventoryItemId: id, purchase: { ...inDay("purchaseDate", range) } }, orderBy: { createdAt: "desc" }, take: LIMIT, include: { purchase: { select: { purchaseNo: true, purchaseDate: true, status: true, supplier: { select: { name: true } } } } } });
    const st = num(i.quantity) <= 0 ? "OUT OF STOCK" : num(i.reorderLevel) > 0 && num(i.quantity) <= num(i.reorderLevel) ? "LOW STOCK" : "NORMAL";
    return {
      title: `Inventory report — ${i.name}`, subtitle: `${i.sku || "no SKU"} · ${i.branch.name} · purchases ${rangeText(from, to)}`,
      summary: [S("In stock", `${num(i.quantity)} ${i.unit}`, "t"), S("Reorder level", `${num(i.reorderLevel)} ${i.unit}`, "t"), S("Status", st, "s"), S("Unit cost", num(i.unitCost), "m"), S("Stock value", num(i.quantity) * num(i.unitCost), "m")],
      tables: [T("Purchase history", [col("Date", "date", "d"), col("Purchase", "purchaseNo"), col("Supplier", "supplier"), col("Quantity", "quantity", "n"), col("Unit cost", "unitCost", "m"), col("Status", "status", "s")], bought.map((b) => ({ date: b.purchase.purchaseDate, purchaseNo: b.purchase.purchaseNo, supplier: b.purchase.supplier.name, quantity: num(b.quantity), unitCost: num(b.unitCost), status: b.purchase.status })))],
    };
  },

  async staff({ scope, id }) {
    const u = await prisma.user.findFirst({ where: { id, ...staffWhere(scope) }, select: { name: true, phone: true, email: true, status: true, createdAt: true, userRoles: { select: { role: { select: { name: true, description: true, branchId: true, permissions: { select: { permission: { select: { key: true } } } } } } } }, memberships: { select: { branch: { select: { name: true } } } } } });
    if (!u) return null;
    const roles = u.userRoles.map((r) => r.role).filter((r) => !ADMIN_ROLE_NAMES.includes(r.name));
    const keys = new Set(roles.flatMap((r) => r.permissions.map((p) => p.permission.key)));
    return {
      title: `Staff report — ${u.name}`, subtitle: `${u.memberships.map((m) => m.branch.name).join(", ") || "—"}${u.phone ? ` · ${u.phone}` : ""}`,
      summary: [S("Status", u.status, "s"), S("Role", roles.map((r) => r.name).join(", ") || "—", "t"), S("Permissions", keys.size), S("Joined", u.createdAt, "d")],
      tables: [T("Permissions", [col("Permission", "name"), col("Key", "key")], PERMISSION_CATALOG.filter((p) => keys.has(p.key)).map((p) => ({ name: p.name, key: p.key })))],
    };
  },

  async profit({ scope, range, id, from, to }) {
    const b = await prisma.branch.findFirst({ where: { id, ...(scope.organizationId ? { organizationId: scope.organizationId } : {}), ...(scope.branchId ? { id: scope.branchId } : {}) }, select: { id: true, name: true, organizationId: true } });
    if (!b) return null;
    return profitReport({ organizationId: b.organizationId, branchId: b.id }, range, from, to, `Profit & loss — ${b.name}`);
  },
};
