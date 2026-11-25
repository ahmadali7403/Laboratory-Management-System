import { ADMIN_ROLE_NAMES, authorityWhere } from "@/lib/scope";

// Definitions for the generic record detail page (/view/<module>/<id>).
// Every query is restricted by the actor's authority (organization / branch), independent of the UI selector.
// kinds: t=text, d=date, dt=datetime, m=money, n=number, b=boolean, s=status
export const VIEW_DEFS = {
  patients: {
    title: "Patient", back: "/patients", model: "patient",
    where: (a) => authorityWhere(a),
    include: { branch: { select: { name: true } }, orders: { orderBy: { createdAt: "desc" }, take: 100, include: { items: { select: { testName: true, resultStatus: true } }, payments: { orderBy: { createdAt: "desc" } } } } },
    summary: (r) => {
      const live = r.orders.filter((o) => o.status !== "CANCELLED");
      const billed = live.reduce((s, o) => s + Number(o.total), 0);
      const paid = live.reduce((s, o) => s + Number(o.paidAmount), 0);
      return [["Visits (orders)", live.length], ["Total billed", billed, "m"], ["Total paid", paid, "m"], ["Outstanding", billed - paid, "m"], ["Discounts given", live.reduce((s, o) => s + Number(o.discount), 0), "m"]];
    },
    tables: [
      { title: "Orders & tests", rows: (r) => r.orders, cols: [["Date", "createdAt", "dt"], ["Order", "orderNo", "t", (x) => `/view/orders/${x.id}`], ["Tests", (x) => x.items.map((i) => i.testName).join(", ")], ["Total", "total", "m"], ["Paid", "paidAmount", "m"], ["Payment", "paymentStatus", "s"], ["Status", "status", "s"]] },
      { title: "Payments", rows: (r) => r.orders.flatMap((o) => o.payments.map((p) => ({ ...p, orderNo: o.orderNo }))), cols: [["Date", "createdAt", "dt"], ["Order", "orderNo"], ["Amount", "amount", "m"], ["Method", "method"], ["Reference", "reference"]] },
    ],
    fields: [["MRN", "mrn"], ["Name", "name"], ["Father / husband", "fatherName"], ["Gender", "gender"], ["Date of birth", "dateOfBirth", "d"], ["Phone", "phone"], ["CNIC", "cnic"], ["Email", "email"], ["Branch", (r) => r.branch?.name], ["Walk-in", "isWalkIn", "b"], ["Registered", "createdAt", "dt"], ["Address", "address"], ["Notes", "notes"]],
  },
  doctors: {
    title: "Doctor", back: "/doctors", model: "doctor",
    where: (a) => ({ ...authorityWhere(a), ...(a.role === "BRANCH_ADMIN" ? { OR: [{ branchId: null }, { branchId: a.branchId }], branchId: undefined } : {}) }),
    include: { branch: { select: { name: true } }, orders: { orderBy: { createdAt: "desc" }, take: 100, include: { patient: { select: { name: true, mrn: true } } } } },
    summary: (r) => { const live = r.orders.filter((o) => o.status !== "CANCELLED"); return [["Referred orders (last 100)", live.length], ["Billed", live.reduce((s, o) => s + Number(o.total), 0), "m"], ["Collected", live.reduce((s, o) => s + Number(o.paidAmount), 0), "m"]]; },
    tables: [{ title: "Referred orders", rows: (r) => r.orders, cols: [["Date", "createdAt", "dt"], ["Order", "orderNo", "t", (x) => `/view/orders/${x.id}`], ["Patient", (x) => `${x.patient.name} (${x.patient.mrn})`], ["Total", "total", "m"], ["Status", "status", "s"]] }],
    fields: [["Name", "name"], ["Specialization", "specialization"], ["Phone", "phone"], ["Email", "email"], ["Available to", (r) => r.branch?.name || "All branches"], ["Active", "isActive", "b"], ["Added", "createdAt", "dt"]],
  },
  tests: {
    title: "Test", back: "/tests", model: "test",
    where: (a) => ({ ...authorityWhere(a), ...(a.role === "BRANCH_ADMIN" ? { OR: [{ branchId: null }, { branchId: a.branchId }], branchId: undefined } : {}) }),
    include: { branch: { select: { name: true } }, parameters: { orderBy: { sortOrder: "asc" } } },
    fields: [["Code", "code"], ["Name", "name"], ["Category", "category"], ["Sample type", "sampleType"], ["Price", "price", "m"], ["Unit", "unit"], ["Reference", (r) => r.refRangeText || (r.refLow != null || r.refHigh != null ? `${r.refLow ?? "…"} - ${r.refHigh ?? "…"}` : null)], ["Turnaround (h)", "turnaroundHours"], ["Available to", (r) => r.branch?.name || "All branches"], ["Active", "isActive", "b"]],
    tables: [{ title: "Parameters", rows: (r) => r.parameters, cols: [["Parameter", "name"], ["Unit", "unit"], ["Low", "refLow"], ["High", "refHigh"], ["Text range", "refRangeText"]] }],
  },
  suppliers: {
    title: "Supplier", back: "/suppliers", model: "supplier",
    where: (a) => ({ ...authorityWhere(a), ...(a.role === "BRANCH_ADMIN" ? { OR: [{ branchId: null }, { branchId: a.branchId }], branchId: undefined } : {}) }),
    include: { branch: { select: { name: true } }, purchases: { orderBy: { purchaseDate: "desc" }, take: 50 } },
    fields: [["Name", "name"], ["Contact person", "contactPerson"], ["Phone", "phone"], ["Email", "email"], ["Address", "address"], ["Available to", (r) => r.branch?.name || "All branches"], ["Active", "isActive", "b"]],
    summary: (r) => [["Purchases (listed)", r.purchases.length], ["Total purchased (not cancelled)", r.purchases.filter((p) => p.status !== "CANCELLED").reduce((s, p) => s + Number(p.total), 0), "m"]],
    tables: [{ title: "Purchase history", rows: (r) => r.purchases, cols: [["No", "purchaseNo"], ["Date", "purchaseDate", "d"], ["Total", "total", "m"], ["Status", "status"]] }],
  },
  inventory: {
    title: "Inventory item", back: "/inventory", model: "inventoryItem",
    where: (a) => authorityWhere(a),
    include: { branch: { select: { name: true } }, purchaseItems: { orderBy: { createdAt: "desc" }, take: 30, include: { purchase: { select: { purchaseNo: true, purchaseDate: true, status: true, supplier: { select: { name: true } } } } } } },
    fields: [["Name", "name"], ["SKU / code", "sku"], ["In stock", (r) => `${Number(r.quantity)} ${r.unit}`], ["Reorder level", (r) => `${Number(r.reorderLevel)} ${r.unit}`], ["Stock status", (r) => (Number(r.quantity) <= 0 ? "Out of stock" : Number(r.reorderLevel) > 0 && Number(r.quantity) <= Number(r.reorderLevel) ? "Low stock" : "Normal")], ["Unit cost", "unitCost", "m"], ["Stock value", (r) => (r.unitCost == null ? null : `Rs ${(Number(r.quantity) * Number(r.unitCost)).toLocaleString("en-PK")}`)], ["Branch", (r) => r.branch?.name], ["Active", "isActive", "b"]],
    tables: [{ title: "Purchase history", rows: (r) => r.purchaseItems, cols: [["Purchase", (x) => x.purchase.purchaseNo], ["Date", (x) => x.purchase.purchaseDate, "d"], ["Supplier", (x) => x.purchase.supplier.name], ["Qty", (x) => Number(x.quantity)], ["Status", (x) => x.purchase.status]] }],
  },
  expenses: {
    title: "Expense", back: "/expenses", model: "expense",
    where: (a) => authorityWhere(a),
    include: { branch: { select: { name: true } } },
    fields: [["Date", "expenseDate", "d"], ["Category", "category"], ["Amount", "amount", "m"], ["Payment method", "paymentMethod"], ["Description", "description"], ["Branch", (r) => r.branch?.name], ["Added by", "createdByName"], ["Created", "createdAt", "dt"]],
  },
  purchases: {
    title: "Purchase", back: "/purchases", model: "purchase",
    where: (a) => authorityWhere(a),
    include: { branch: { select: { name: true } }, supplier: { select: { name: true } }, items: { include: { inventoryItem: { select: { name: true, unit: true } } } } },
    fields: [["Purchase no", "purchaseNo"], ["Supplier", (r) => r.supplier.name], ["Date", "purchaseDate", "d"], ["Status", "status", "s"], ["Total", "total", "m"], ["Received", "receivedAt", "dt"], ["Branch", (r) => r.branch?.name], ["Created by", "createdByName"], ["Notes", "notes"]],
    tables: [{ title: "Items", rows: (r) => r.items, cols: [["Item", (x) => x.inventoryItem.name], ["Qty", (x) => `${Number(x.quantity)} ${x.inventoryItem.unit}`], ["Unit cost", (x) => x.unitCost, "m"], ["Line total", (x) => Number(x.quantity) * Number(x.unitCost), "m"]] }],
  },
  orders: {
    title: "Order", back: "/orders", model: "labOrder",
    where: (a) => authorityWhere(a),
    include: {
      branch: { select: { name: true } }, patient: { select: { id: true, name: true, mrn: true, phone: true } }, doctor: { select: { name: true } },
      items: { orderBy: { createdAt: "asc" } }, samples: true, payments: { orderBy: { createdAt: "desc" } },
    },
    fields: [["Order no", "orderNo"], ["Patient", (r) => `${r.patient.name} (${r.patient.mrn})`, "t", (r) => `/view/patients/${r.patient.id}`], ["Phone", (r) => r.patient.phone], ["Doctor", (r) => r.doctor?.name || r.referredBy], ["Status", "status", "s"], ["Payment", "paymentStatus", "s"], ["Subtotal", "subtotal", "m"], ["Discount", "discount", "m"], ["Total", "total", "m"], ["Paid", "paidAmount", "m"], ["Balance", (r) => Number(r.total) - Number(r.paidAmount), "m"], ["Branch", (r) => r.branch?.name], ["Created", "createdAt", "dt"], ["Created by", "createdByName"], ["Notes", "notes"]],
    tables: [
      { title: "Tests & results", rows: (r) => r.items, cols: [["Test", "testName"], ["Price", "price", "m"], ["Result", (x) => (x.resultValue ? `${x.resultValue} ${x.unit || ""}` : null)], ["Flag", "flag"], ["Status", "resultStatus", "s"]] },
      { title: "Samples", rows: (r) => r.samples, cols: [["Sample", "sampleNo"], ["Type", "sampleType"], ["Status", "status", "s"], ["Collected", "collectedAt", "dt"], ["Rejection", "rejectionReason"]] },
      { title: "Payments", rows: (r) => r.payments, cols: [["Date", "createdAt", "dt"], ["Amount", "amount", "m"], ["Method", "method"], ["Reference", "reference"], ["By", "receivedByName"]] },
    ],
    extraLinks: (r) => [[`Invoice`, `/billing/${r.id}`], ...(r.status === "COMPLETED" ? [[`Lab report`, `/reports/${r.id}`]] : [])],
  },
  samples: {
    title: "Sample", back: "/samples/list", model: "sample",
    where: (a) => ({ order: authorityWhere(a) }),
    include: { order: { select: { id: true, orderNo: true, branch: { select: { name: true } }, patient: { select: { id: true, name: true, mrn: true } } } }, items: { select: { testName: true, resultStatus: true } } },
    fields: [["Sample no", "sampleNo"], ["Type", "sampleType"], ["Status", "status", "s"], ["Order", (r) => r.order.orderNo, "t", (r) => `/view/orders/${r.order.id}`], ["Patient", (r) => `${r.order.patient.name} (${r.order.patient.mrn})`, "t", (r) => `/view/patients/${r.order.patient.id}`], ["Branch", (r) => r.order.branch.name], ["Collected", "collectedAt", "dt"], ["Collected by", "collectedByName"], ["Rejection reason", "rejectionReason"]],
    tables: [{ title: "Tests on this sample", rows: (r) => r.items, cols: [["Test", "testName"], ["Result", "resultStatus", "s"]] }],
  },
  results: {
    title: "Result", back: "/results/list", model: "labOrderItem",
    where: (a) => ({ order: authorityWhere(a) }),
    include: { order: { select: { id: true, orderNo: true, branch: { select: { name: true } }, patient: { select: { id: true, name: true, mrn: true } } } }, results: true, sample: { select: { sampleNo: true, status: true } } },
    fields: [["Test", "testName"], ["Order", (r) => r.order.orderNo, "t", (r) => `/view/orders/${r.order.id}`], ["Patient", (r) => `${r.order.patient.name} (${r.order.patient.mrn})`, "t", (r) => `/view/patients/${r.order.patient.id}`], ["Status", "resultStatus", "s"], ["Result", (r) => (r.resultValue ? `${r.resultValue} ${r.unit || ""}` : null)], ["Flag", "flag"], ["Reference", "refRange"], ["Sample", (r) => (r.sample ? `${r.sample.sampleNo} (${r.sample.status})` : null)], ["Entered by", "enteredByName"], ["Entered", "enteredAt", "dt"], ["Verified by", "verifiedByName"], ["Verified", "verifiedAt", "dt"], ["Comments", "comments"]],
    tables: [{ title: "Parameters", rows: (r) => r.results, cols: [["Parameter", "name"], ["Value", "value"], ["Unit", "unit"], ["Reference", (x) => x.refRangeText || (x.refLow != null || x.refHigh != null ? `${x.refLow ?? "…"} - ${x.refHigh ?? "…"}` : null)], ["Flag", "flag"]] }],
  },
  staff: {
    title: "Staff member", back: "/staff", model: "user",
    where: (a) => ({ ...(authorityWhere(a).organizationId ? { organizationId: authorityWhere(a).organizationId } : {}), ...(a.role === "BRANCH_ADMIN" ? { memberships: { some: { branchId: a.branchId } } } : {}), userRoles: { some: { role: { name: { notIn: ADMIN_ROLE_NAMES } } } } }),
    include: { userRoles: { select: { role: { select: { name: true } } } }, memberships: { select: { branch: { select: { name: true } } } } },
    fields: [["Name", "name"], ["Email", (r) => (r.email.endsWith("@staff.labos.local") ? null : r.email)], ["Phone", "phone"], ["Role", (r) => r.userRoles.map((x) => x.role.name).join(", ")], ["Branch", (r) => r.memberships.map((m) => m.branch.name).join(", ")], ["Status", "status", "s"], ["Added", "createdAt", "dt"]],
  },
};
