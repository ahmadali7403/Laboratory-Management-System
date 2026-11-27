import { prisma } from "@/lib/prisma";
import { scopeWhere } from "@/lib/scope";
import { round2 } from "@/lib/http";
import { parseRange } from "@/lib/report-engine";
import { daysFromTodayUtc, enrichMedicine, PHARMACY_REPORT_TYPES, todayUtcDate } from "@/lib/pharmacy";

const n = (v) => (v == null ? 0 : Number(v));

export { PHARMACY_REPORT_TYPES };

export async function runPharmacyReport(scope, type, { from = null, to = null } = {}) {
  const base = scopeWhere(scope);
  const range = parseRange(from, to);
  const createdWhere = range ? { createdAt: { gte: range.gte, lt: range.lt } } : {};
  const dayPurchaseWhere = range ? { purchaseDate: range.day } : {};

  switch (type) {
    case "sales": {
      const sales = await prisma.pharmacySale.findMany({
        where: { ...base, ...createdWhere },
        orderBy: { createdAt: "desc" },
        take: 500,
        include: { branch: { select: { name: true } }, _count: { select: { items: true } } },
      });
      const live = sales.filter((s) => s.status !== "CANCELLED");
      return {
        title: "Pharmacy Sales Report",
        summary: [
          { label: "Total Sales", value: live.length, kind: "n" },
          { label: "Gross Total", value: round2(live.reduce((a, s) => a + n(s.total), 0)), kind: "m" },
          { label: "Paid", value: round2(live.reduce((a, s) => a + n(s.paidAmount), 0)), kind: "m" },
          { label: "Refunded", value: round2(live.reduce((a, s) => a + n(s.refundedAmount), 0)), kind: "m" },
          { label: "Discounts", value: round2(live.reduce((a, s) => a + n(s.discount) + n(s.itemDiscountTotal), 0)), kind: "m" },
        ],
        columns: ["Date", "Sale No", "Customer", "Items", "Subtotal", "Discount", "Total", "Paid", "Payment", "Status"],
        rows: sales.map((s) => ({
          Date: s.createdAt,
          "Sale No": s.saleNo,
          Customer: s.customerName,
          Items: s._count.items,
          Subtotal: n(s.subtotal),
          Discount: round2(n(s.discount) + n(s.itemDiscountTotal)),
          Total: n(s.total),
          Paid: n(s.paidAmount),
          Payment: s.paymentStatus,
          Status: s.status,
        })),
      };
    }

    case "purchases": {
      const purchases = await prisma.pharmacyPurchase.findMany({
        where: { ...base, ...dayPurchaseWhere },
        orderBy: { purchaseDate: "desc" },
        take: 500,
        include: { supplier: { select: { name: true } }, _count: { select: { items: true } } },
      });
      const fin = purchases.filter((p) => p.status === "FINALIZED");
      return {
        title: "Pharmacy Purchases Report",
        summary: [
          { label: "Total Purchases", value: purchases.length, kind: "n" },
          { label: "Finalized", value: fin.length, kind: "n" },
          { label: "Finalized Value", value: round2(fin.reduce((a, p) => a + n(p.total), 0)), kind: "m" },
          { label: "Paid", value: round2(fin.reduce((a, p) => a + n(p.paidAmount), 0)), kind: "m" },
          { label: "Payable", value: round2(fin.reduce((a, p) => a + Math.max(0, n(p.total) - n(p.returnedAmount) - n(p.paidAmount)), 0)), kind: "m" },
        ],
        columns: ["Date", "Purchase No", "Supplier", "Invoice No", "Items", "Total", "Paid", "Payment", "Status"],
        rows: purchases.map((p) => ({
          Date: p.purchaseDate,
          "Purchase No": p.purchaseNo,
          Supplier: p.supplier?.name || "—",
          "Invoice No": p.invoiceNo || "—",
          Items: p._count.items,
          Total: n(p.total),
          Paid: n(p.paidAmount),
          Payment: p.paymentStatus,
          Status: p.status,
        })),
      };
    }

    case "stock": {
      const meds = await prisma.medicine.findMany({
        where: { ...base, status: "ACTIVE" },
        orderBy: { name: "asc" },
        take: 1500,
        include: {
          category: { select: { name: true } },
          company: { select: { name: true } },
          batches: { where: { isActive: true, quantity: { gt: 0 } } },
        },
      });
      const rows = meds.map((m) => {
        const e = enrichMedicine(m);
        const retailVal = (m.batches || []).reduce((a, b) => a + n(b.quantity) * n(b.salePrice), 0);
        return {
          Medicine: m.name,
          Generic: m.genericName || "—",
          Category: m.category?.name || "—",
          Company: m.company?.name || "—",
          "Valid Stock": e.validStock,
          "Expired Stock": e.expiredStock,
          "Alert Level": n(m.lowStockAlert),
          "Purchase Value": e.stockValue,
          "Retail Value": round2(retailVal),
          Status: e.stockStatus,
        };
      });
      return {
        title: "Pharmacy Stock Valuation Report",
        summary: [
          { label: "Medicines", value: rows.length, kind: "n" },
          { label: "Total Cost Value", value: round2(rows.reduce((a, r) => a + r["Purchase Value"], 0)), kind: "m" },
          { label: "Total Retail Value", value: round2(rows.reduce((a, r) => a + r["Retail Value"], 0)), kind: "m" },
          { label: "Low Stock", value: rows.filter((r) => r.Status === "LOW").length, kind: "n" },
          { label: "Out of Stock", value: rows.filter((r) => r.Status === "OUT").length, kind: "n" },
        ],
        columns: ["Medicine", "Generic", "Category", "Company", "Valid Stock", "Expired Stock", "Alert Level", "Purchase Value", "Retail Value", "Status"],
        rows,
      };
    }

    case "low_stock": {
      const meds = await prisma.medicine.findMany({
        where: { ...base, status: "ACTIVE" },
        orderBy: { name: "asc" },
        take: 1500,
        include: {
          category: { select: { name: true } },
          defaultSupplier: { select: { name: true } },
          batches: { where: { isActive: true, quantity: { gt: 0 } } },
        },
      });
      const rows = meds
        .map((m) => enrichMedicine(m))
        .filter((e) => e.stockStatus === "LOW" || e.stockStatus === "OUT")
        .map((e) => ({
          Medicine: e.name,
          Generic: e.genericName || "—",
          Strength: e.strength || "—",
          Category: e.category?.name || "—",
          Supplier: e.defaultSupplier?.name || "—",
          "Available Stock": e.validStock,
          "Alert Level": n(e.lowStockAlert),
          "Restock Suggested": Math.max(0, round2(n(e.lowStockAlert) - e.validStock)),
          Status: e.stockStatus,
        }));
      return {
        title: "Low & Out of Stock Report",
        summary: [
          { label: "Affected Medicines", value: rows.length, kind: "n" },
          { label: "Out of Stock", value: rows.filter((r) => r.Status === "OUT").length, kind: "n" },
          { label: "Low Stock", value: rows.filter((r) => r.Status === "LOW").length, kind: "n" },
        ],
        columns: ["Medicine", "Generic", "Strength", "Category", "Supplier", "Available Stock", "Alert Level", "Restock Suggested", "Status"],
        rows,
      };
    }

    case "expiry": {
      const today = todayUtcDate();
      const plus90 = daysFromTodayUtc(90);
      const batches = await prisma.medicineBatch.findMany({
        where: { ...base, isActive: true, quantity: { gt: 0 }, expiryDate: { lte: plus90 } },
        orderBy: { expiryDate: "asc" },
        take: 500,
        include: { medicine: { select: { name: true, genericName: true, strength: true } }, supplier: { select: { name: true } } },
      });
      const rows = batches.map((b) => {
        const exp = new Date(b.expiryDate);
        const state = exp < today ? "EXPIRED" : exp <= daysFromTodayUtc(30) ? "EXPIRING_30D" : "EXPIRING_90D";
        return {
          Medicine: b.medicine.name,
          Generic: b.medicine.genericName || "—",
          Batch: b.batchNumber,
          Expiry: b.expiryDate,
          Quantity: n(b.quantity),
          "Cost Value": round2(n(b.quantity) * n(b.purchasePrice)),
          Supplier: b.supplier?.name || "—",
          Status: state,
        };
      });
      return {
        title: "Expiry & Near-Expiry Report (90 Days)",
        summary: [
          { label: "Total Batches", value: rows.length, kind: "n" },
          { label: "Expired Batches", value: rows.filter((r) => r.Status === "EXPIRED").length, kind: "n" },
          { label: "Expiring ≤ 30d", value: rows.filter((r) => r.Status === "EXPIRING_30D").length, kind: "n" },
          { label: "At-Risk Value", value: round2(rows.reduce((a, r) => a + r["Cost Value"], 0)), kind: "m" },
        ],
        columns: ["Medicine", "Generic", "Batch", "Expiry", "Quantity", "Cost Value", "Supplier", "Status"],
        rows,
      };
    }

    case "profit": {
      const items = await prisma.pharmacySaleItem.findMany({
        where: { sale: { ...base, status: { not: "CANCELLED" }, ...createdWhere } },
        orderBy: { sale: { createdAt: "desc" } },
        take: 1000,
        include: { sale: { select: { saleNo: true, createdAt: true, discount: true } } },
      });
      const rows = items.map((i) => {
        const netQty = Math.max(0, n(i.quantity) - n(i.returnedQuantity));
        const ratio = n(i.quantity) > 0 ? netQty / n(i.quantity) : 0;
        const netSales = round2(n(i.lineTotal) * ratio);
        const netCost = round2(netQty * n(i.costPrice));
        const margin = round2(netSales - netCost);
        return {
          Date: i.sale.createdAt,
          "Sale No": i.sale.saleNo,
          Medicine: i.medicineName,
          Batch: i.batchNumber,
          "Net Qty": netQty,
          Revenue: netSales,
          Cost: netCost,
          Profit: margin,
        };
      });
      const revenue = round2(rows.reduce((a, r) => a + r.Revenue, 0));
      const cost = round2(rows.reduce((a, r) => a + r.Cost, 0));
      return {
        title: "Pharmacy Sales Margin & Profit Report",
        summary: [
          { label: "Line Items", value: rows.length, kind: "n" },
          { label: "Item Revenue", value: revenue, kind: "m" },
          { label: "Cost of Goods", value: cost, kind: "m" },
          { label: "Gross Profit", value: round2(revenue - cost), kind: "m" },
        ],
        columns: ["Date", "Sale No", "Medicine", "Batch", "Net Qty", "Revenue", "Cost", "Profit"],
        rows,
      };
    }

    case "suppliers": {
      const suppliers = await prisma.supplier.findMany({
        where: scopeWhere(scope, { shared: true }),
        orderBy: { name: "asc" },
        take: 500,
        include: {
          pharmacyPurchases: { where: { ...base, status: "FINALIZED" }, select: { total: true, paidAmount: true, returnedAmount: true } },
        },
      });
      const rows = suppliers.map((s) => {
        const purchased = s.pharmacyPurchases.reduce((a, p) => a + n(p.total), 0);
        const paid = s.pharmacyPurchases.reduce((a, p) => a + n(p.paidAmount), 0);
        return {
          Supplier: s.name,
          Contact: s.contactPerson || "—",
          Phone: s.phone || "—",
          Purchases: s.pharmacyPurchases.length,
          "Total Purchased": round2(purchased),
          "Paid on Purchases": round2(paid),
          "Payable Balance": n(s.pharmacyBalance),
          Status: s.isActive ? "ACTIVE" : "INACTIVE",
        };
      });
      return {
        title: "Pharmacy Suppliers Balance Report",
        summary: [
          { label: "Suppliers", value: rows.length, kind: "n" },
          { label: "Total Purchased", value: round2(rows.reduce((a, r) => a + r["Total Purchased"], 0)), kind: "m" },
          { label: "Outstanding Balance", value: round2(rows.reduce((a, r) => a + r["Payable Balance"], 0)), kind: "m" },
        ],
        columns: ["Supplier", "Contact", "Phone", "Purchases", "Total Purchased", "Paid on Purchases", "Payable Balance", "Status"],
        rows,
      };
    }

    case "movements": {
      const rows = await prisma.pharmacyStockMovement.findMany({
        where: { ...base, ...createdWhere },
        orderBy: { createdAt: "desc" },
        take: 500,
        include: { medicine: { select: { name: true } }, batch: { select: { batchNumber: true } } },
      });
      return {
        title: "Pharmacy Stock Movement Ledger",
        summary: [
          { label: "Movements", value: rows.length, kind: "n" },
          { label: "Inbound Qty", value: round2(rows.filter((r) => n(r.quantityChange) > 0).reduce((a, r) => a + n(r.quantityChange), 0)), kind: "n" },
          { label: "Outbound Qty", value: round2(rows.filter((r) => n(r.quantityChange) < 0).reduce((a, r) => a + Math.abs(n(r.quantityChange)), 0)), kind: "n" },
        ],
        columns: ["Date", "Medicine", "Batch", "Type", "Change", "Before", "After", "Ref", "Reason", "By"],
        rows: rows.map((r) => ({
          Date: r.createdAt,
          Medicine: r.medicine.name,
          Batch: r.batch.batchNumber,
          Type: r.type,
          Change: n(r.quantityChange),
          Before: n(r.balanceBefore),
          After: n(r.balanceAfter),
          Ref: r.referenceNo || "—",
          Reason: r.reason || "—",
          By: r.createdByName,
        })),
      };
    }

    case "price_audits": {
      const rows = await prisma.pharmacyPriceAudit.findMany({
        where: { ...base, ...createdWhere },
        orderBy: { createdAt: "desc" },
        take: 500,
        include: { medicine: { select: { name: true } }, batch: { select: { batchNumber: true } } },
      });
      return {
        title: "Medicine Price Change Audit",
        summary: [{ label: "Price Changes", value: rows.length, kind: "n" }],
        columns: ["Date", "Medicine", "Batch", "Old Cost", "New Cost", "Old Sale", "New Sale", "Reason", "By"],
        rows: rows.map((r) => ({
          Date: r.createdAt,
          Medicine: r.medicine.name,
          Batch: r.batch?.batchNumber || "Catalog",
          "Old Cost": r.oldPurchasePrice == null ? "—" : n(r.oldPurchasePrice),
          "New Cost": r.newPurchasePrice == null ? "—" : n(r.newPurchasePrice),
          "Old Sale": r.oldSalePrice == null ? "—" : n(r.oldSalePrice),
          "New Sale": r.newSalePrice == null ? "—" : n(r.newSalePrice),
          Reason: r.reason || "—",
          By: r.changedByName,
        })),
      };
    }

    default:
      return null;
  }
}
