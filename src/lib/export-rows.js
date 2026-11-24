// Plain-text rows used by Export CSV / Print on every list page (keyed by API endpoint).
const d = (v) => (v ? new Date(v).toISOString().slice(0, 10) : "");
const dt = (v) => (v ? new Date(v).toLocaleString("en-GB", { timeZone: "Asia/Karachi" }) : "");
const age = (dob) => (dob ? `${Math.max(0, Math.floor((Date.now() - new Date(dob)) / 3.156e10))}` : "");
const where = (r) => r.branch?.name || "All branches";
const yn = (b) => (b ? "Active" : "Inactive");

export const EXPORT_ROWS = {
  "/api/patients": (r) => ({ MRN: r.mrn, Name: r.name, "Father/Husband": r.fatherName, Gender: r.gender, Age: age(r.dateOfBirth), Phone: r.phone, CNIC: r.cnic, Address: r.address, Branch: where(r), Walkin: r.isWalkIn ? "Yes" : "No", Registered: dt(r.createdAt) }),
  "/api/doctors": (r) => ({ Name: r.name, Specialization: r.specialization, Phone: r.phone, Email: r.email, "Available to": where(r), Status: yn(r.isActive) }),
  "/api/tests": (r) => ({ Code: r.code, Test: r.name, Category: r.category, Sample: r.sampleType, Price: r.price, Parameters: (r.parameters || []).map((p) => p.name).join(" | "), "Available to": where(r), Status: yn(r.isActive) }),
  "/api/suppliers": (r) => ({ Supplier: r.name, Contact: r.contactPerson, Phone: r.phone, Email: r.email, Address: r.address, "Available to": where(r), Status: yn(r.isActive) }),
  "/api/inventory": (r) => ({ Item: r.name, SKU: r.sku, Unit: r.unit, "In stock": r.quantity, "Reorder level": r.reorderLevel, "Unit cost": r.unitCost, Branch: where(r), Status: yn(r.isActive) }),
  "/api/expenses": (r) => ({ Date: d(r.expenseDate), Category: r.category, Description: r.description, Amount: r.amount, Method: r.paymentMethod, Branch: where(r), "Added by": r.createdByName }),
  "/api/orders": (r) => ({ Order: r.orderNo, Patient: r.patient?.name, MRN: r.patient?.mrn, Branch: r.branch?.name, Tests: r._count?.items, Total: r.total, Paid: r.paidAmount, Balance: Number(r.total) - Number(r.paidAmount), Status: r.status, Payment: r.paymentStatus, Created: dt(r.createdAt) }),
  "/api/billing": (r) => ({ Date: dt(r.createdAt), Order: r.order?.orderNo, Patient: r.order?.patient?.name, Branch: r.branch?.name, Method: r.method, Reference: r.reference, "Received by": r.receivedByName, Amount: r.amount }),
  "/api/samples": (r) => ({ Sample: r.sampleNo, Type: r.sampleType, Patient: r.order?.patient?.name, MRN: r.order?.patient?.mrn, Tests: (r.items || []).map((i) => i.testName).join(" | "), Branch: r.order?.branch?.name, Status: r.status, Collected: dt(r.collectedAt) }),
  "/api/results": (r) => ({ Order: r.order?.orderNo, Patient: r.order?.patient?.name, Branch: r.order?.branch?.name, Test: r.testName, Result: r.results?.length ? r.results.map((x) => `${x.name}: ${x.value ?? ""}`).join("; ") : r.resultValue, Status: r.resultStatus, Verified: dt(r.verifiedAt) }),
  "/api/purchases": (r) => ({ Purchase: r.purchaseNo, Supplier: r.supplier?.name, Branch: r.branch?.name, Date: d(r.purchaseDate), Items: (r.items || []).map((i) => `${i.inventoryItem?.name} x${i.quantity}`).join("; "), Total: r.total, Status: r.status }),
  "/api/staff": (r) => ({ Name: r.name, Role: r.role?.name, Branch: r.branch?.name, Email: r.email, Phone: r.phone, Status: r.status }),
};

// Which backup section a page belongs to (null = export/print only).
export const BACKUP_MODULE = {
  "/api/patients": "patients", "/api/doctors": "doctors", "/api/tests": "tests", "/api/suppliers": "suppliers", "/api/inventory": "inventory",
  "/api/expenses": "expenses", "/api/purchases": "purchases", "/api/orders": "orders", "/api/samples": "orders", "/api/results": "orders", "/api/billing": "orders",
};
