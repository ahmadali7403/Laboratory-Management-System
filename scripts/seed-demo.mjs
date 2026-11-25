import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const prisma = new PrismaClient();
const organizationId = process.env.DEMO_ORGANIZATION_ID;
const requestedBranchId = process.env.DEMO_BRANCH_ID;

const permissionCatalog = [
  "patients", "doctors", "tests", "orders", "samples", "results", "verification",
  "reports", "billing", "expenses", "inventory", "suppliers", "purchases",
].flatMap((key) => [
  { key: `${key}.view`, name: `View ${key}` },
  { key: `${key}.manage`, name: `Manage ${key}` },
]);

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing. Add your database connection to .env first.");
  if (!organizationId) throw new Error("Set DEMO_ORGANIZATION_ID in .env to the organization where demo records should be created.");

  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true, status: true } });
  if (!organization) throw new Error("The DEMO_ORGANIZATION_ID does not match an organization in this database.");
  if (organization.status !== "ACTIVE") throw new Error("The selected organization is not active. Activate it before seeding demo records.");

  const branch = requestedBranchId
    ? await prisma.branch.findFirst({ where: { id: requestedBranchId, organizationId, status: "ACTIVE" } })
    : await prisma.branch.findFirst({ where: { organizationId, status: "ACTIVE" }, orderBy: [{ isHeadOffice: "desc" }, { createdAt: "asc" }] });
  if (!branch) throw new Error("No active branch was found. Set DEMO_BRANCH_ID to an active branch belonging to this organization.");

  const now = new Date();
  const dateOnly = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const created = [];
  const existing = [];
  const mark = (label, wasCreated) => (wasCreated ? created : existing).push(label);

  // Catalog data shared across branches of the selected organization.
  const testRows = [
    { code: "DEMO-CBC", name: "Complete Blood Count", category: "Hematology", sampleType: "Blood", price: 1200, unit: "10^9/L", refLow: 4, refHigh: 11, refRangeText: "4.0–11.0 x10^9/L", turnaroundHours: 6 },
    { code: "DEMO-GLU", name: "Fasting Blood Glucose", category: "Biochemistry", sampleType: "Blood", price: 500, unit: "mg/dL", refLow: 70, refHigh: 100, turnaroundHours: 3 },
    { code: "DEMO-LFT", name: "Liver Function Tests", category: "Biochemistry", sampleType: "Blood", price: 1800, unit: "U/L", refRangeText: "See individual analytes", turnaroundHours: 12 },
  ];
  const tests = [];
  for (const data of testRows) {
    const row = await prisma.test.upsert({
      where: { organizationId_code: { organizationId, code: data.code } },
      update: { branchId: null },
      create: { ...data, organizationId, branchId: null },
    });
    tests.push(row);
    mark(`Test: ${data.name}`, row.createdAt.getTime() >= now.getTime() - 3000);
  }

  let doctor = await prisma.doctor.findFirst({ where: { organizationId, name: "Dr. Ayesha Khan", specialization: "Pathology" } });
  if (!doctor) {
    doctor = await prisma.doctor.create({ data: { organizationId, branchId: null, name: "Dr. Ayesha Khan", specialization: "Pathology", phone: "+92 300 1234567", email: "demo.pathologist@example.com" } });
    mark("Doctor: Dr. Ayesha Khan", true);
  } else mark("Doctor: Dr. Ayesha Khan", false);

  let supplier = await prisma.supplier.findFirst({ where: { organizationId, name: "MedLab Scientific Supplies" } });
  if (!supplier) {
    supplier = await prisma.supplier.create({ data: { organizationId, branchId: null, name: "MedLab Scientific Supplies", contactPerson: "Hassan Raza", phone: "+92 321 7654321", email: "orders@medlab-demo.example", address: "Lahore, Pakistan" } });
    mark("Supplier: MedLab Scientific Supplies", true);
  } else mark("Supplier: MedLab Scientific Supplies", false);

  // Branch-owned records.
  const patientData = [
    { mrn: "DEMO-MRN-001", name: "Muhammad Usman", gender: "MALE", dateOfBirth: new Date("1994-03-12T00:00:00.000Z"), phone: "+92 300 1112233", cnic: "35202-1234567-1", address: "Model Town, Lahore" },
    { mrn: "DEMO-MRN-002", name: "Fatima Noor", gender: "FEMALE", dateOfBirth: new Date("1988-09-24T00:00:00.000Z"), phone: "+92 333 4445566", cnic: "35202-7654321-2", address: "Johar Town, Lahore" },
  ];
  const patients = [];
  for (const data of patientData) {
    const row = await prisma.patient.upsert({
      where: { organizationId_mrn: { organizationId, mrn: data.mrn } },
      update: {},
      create: { ...data, organizationId, branchId: branch.id },
    });
    if (row.branchId !== branch.id) throw new Error(`Demo patient ${data.mrn} already belongs to another branch. Use that branch or change the reserved demo MRN in scripts/seed-demo.mjs.`);
    patients.push(row);
    mark(`Patient: ${data.name}`, row.createdAt.getTime() >= now.getTime() - 3000);
  }

  const inventoryRows = [
    { name: "CBC Reagent Kit", sku: "DEMO-INV-001", unit: "kit", quantity: 18, reorderLevel: 5, unitCost: 4200 },
    { name: "Glucose Reagent", sku: "DEMO-INV-002", unit: "bottle", quantity: 3, reorderLevel: 5, unitCost: 1850 },
    { name: "EDTA Collection Tubes", sku: "DEMO-INV-003", unit: "box", quantity: 24, reorderLevel: 8, unitCost: 950 },
  ];
  const inventory = [];
  for (const data of inventoryRows) {
    const row = await prisma.inventoryItem.upsert({
      where: { branchId_name: { branchId: branch.id, name: data.name } },
      update: {},
      create: { ...data, organizationId, branchId: branch.id },
    });
    inventory.push(row);
    mark(`Inventory: ${data.name}`, row.createdAt.getTime() >= now.getTime() - 3000);
  }

  const expenseRows = [
    { category: "Utilities", description: "Monthly electricity and water charges (demo record)", amount: 18500 },
    { category: "Medical Supplies", description: "Routine collection and PPE supplies (demo record)", amount: 7200 },
  ];
  for (const data of expenseRows) {
    const found = await prisma.expense.findFirst({ where: { organizationId, branchId: branch.id, description: data.description } });
    if (found) mark(`Expense: ${data.category}`, false);
    else {
      await prisma.expense.create({ data: { ...data, organizationId, branchId: branch.id, expenseDate: dateOnly, createdByName: "LabOS Demo Setup" } });
      mark(`Expense: ${data.category}`, true);
    }
  }

  // One completed report and one active work-in-progress order make the workflow tabs useful.
  const orderSpecs = [
    { orderNo: "DEMO-ORD-001", patient: patients[0], selectedTests: [tests[0], tests[1]], status: "COMPLETED", paymentStatus: "PAID", paidAmount: 1700, discount: 0, sampleStatus: "RECEIVED", resultStatus: "VERIFIED" },
    { orderNo: "DEMO-ORD-002", patient: patients[1], selectedTests: [tests[1], tests[2]], status: "REGISTERED", paymentStatus: "PARTIAL", paidAmount: 500, discount: 0, sampleStatus: "PENDING", resultStatus: "PENDING" },
  ];
  const seededOrders = [];
  for (const spec of orderSpecs) {
    let order = await prisma.labOrder.findUnique({ where: { organizationId_orderNo: { organizationId, orderNo: spec.orderNo } } });
    let orderWasCreated = false;
    if (order && order.branchId !== branch.id) throw new Error(`Demo order ${spec.orderNo} already belongs to another branch. Run the seed against its original branch.`);
    if (!order) {
      const subtotal = spec.selectedTests.reduce((sum, test) => sum + Number(test.price), 0);
      order = await prisma.labOrder.create({
        data: {
          organizationId,
          branchId: branch.id,
          orderNo: spec.orderNo,
          patientId: spec.patient.id,
          doctorId: doctor.id,
          status: spec.status,
          paymentStatus: spec.paymentStatus,
          subtotal,
          discount: spec.discount,
          total: subtotal - spec.discount,
          paidAmount: spec.paidAmount,
          createdByName: "LabOS Demo Setup",
          completedAt: spec.status === "COMPLETED" ? new Date(now.getTime() - 60 * 60 * 1000) : null,
          notes: "Seeded demonstration record. Safe to delete after review.",
        },
      });
      orderWasCreated = true;
    }
    let sample = await prisma.sample.findFirst({ where: { orderId: order.id, sampleType: "Blood" } });
    if (!sample) {
      sample = await prisma.sample.create({ data: { orderId: order.id, sampleType: "Blood", sampleNo: `${spec.orderNo}-S1`, status: spec.sampleStatus, collectedAt: spec.sampleStatus === "RECEIVED" ? new Date(now.getTime() - 2 * 60 * 60 * 1000) : null, collectedByName: spec.sampleStatus === "RECEIVED" ? "Demo Phlebotomist" : null } });
    }
    for (const [index, test] of spec.selectedTests.entries()) {
      const item = await prisma.labOrderItem.findFirst({ where: { orderId: order.id, testId: test.id } });
      if (!item) {
        const verified = spec.resultStatus === "VERIFIED";
        await prisma.labOrderItem.create({
          data: {
            orderId: order.id,
            testId: test.id,
            sampleId: sample.id,
            testName: test.name,
            testCode: test.code,
            price: test.price,
            unit: test.unit,
            refRange: test.refRangeText || (test.refLow != null || test.refHigh != null ? `${test.refLow ?? "…"} - ${test.refHigh ?? "…"}` : null),
            resultValue: verified ? (index === 0 ? "7.2" : "92") : null,
            flag: "NORMAL",
            resultStatus: spec.resultStatus,
            enteredByName: verified ? "Demo Lab Technician" : null,
            enteredAt: verified ? new Date(now.getTime() - 70 * 60 * 1000) : null,
            verifiedByName: verified ? "Dr. Ayesha Khan" : null,
            verifiedAt: verified ? new Date(now.getTime() - 65 * 60 * 1000) : null,
          },
        });
      }
    }
    if (spec.paidAmount > 0 && !(await prisma.payment.findFirst({ where: { orderId: order.id } }))) {
      await prisma.payment.create({ data: { organizationId, branchId: branch.id, orderId: order.id, amount: spec.paidAmount, method: "CASH", reference: `DEMO-${spec.orderNo}`, receivedByName: "LabOS Demo Setup" } });
    }
    seededOrders.push(order);
    mark(`Order: ${spec.orderNo}`, orderWasCreated);
  }

  const purchaseNo = "DEMO-PUR-001";
  const existingPurchase = await prisma.purchase.findUnique({ where: { organizationId_purchaseNo: { organizationId, purchaseNo } } });
  if (!existingPurchase) {
    const items = [{ item: inventory[0], quantity: 2, unitCost: 4200 }, { item: inventory[2], quantity: 4, unitCost: 950 }];
    const total = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
    await prisma.purchase.create({
      data: {
        organizationId, branchId: branch.id, purchaseNo, supplierId: supplier.id, status: "ORDERED", total,
        purchaseDate: dateOnly, createdByName: "LabOS Demo Setup", notes: "Seeded demonstration purchase.",
        items: { create: items.map(({ item, quantity, unitCost }) => ({ inventoryItemId: item.id, quantity, unitCost })) },
      },
    });
    mark(`Purchase: ${purchaseNo}`, true);
  } else mark(`Purchase: ${purchaseNo}`, false);

  // Create a usable custom role and a directory entry. Staff login is intentionally not enabled by this seed.
  await prisma.permission.createMany({ data: permissionCatalog, skipDuplicates: true });
  const roleName = "DEMO_LAB_TECHNICIAN";
  const roleBefore = await prisma.role.findFirst({ where: { organizationId, branchId: null, name: roleName }, select: { id: true } });
  const role = roleBefore || await prisma.role.create({ data: { organizationId, name: roleName, description: "Demo role for sample collection and result entry." } });
  const allowedKeys = ["patients.view", "tests.view", "orders.view", "samples.view", "samples.manage", "results.view", "results.manage", "reports.view"];
  const permissionRows = await prisma.permission.findMany({ where: { key: { in: allowedKeys } }, select: { id: true } });
  for (const permission of permissionRows) {
    await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } }, update: {}, create: { roleId: role.id, permissionId: permission.id } });
  }
  mark(`Role: ${roleName}`, !roleBefore);

  const staffEmail = `demo.lab.technician.${organizationId.slice(0, 8)}@staff.labos.local`;
  let staff = await prisma.user.findUnique({ where: { organizationId_email: { organizationId, email: staffEmail } } });
  if (!staff) {
    staff = await prisma.user.create({ data: { organizationId, name: "Demo Lab Technician", email: staffEmail, password: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10), status: "ACTIVE" } });
    mark("Staff: Demo Lab Technician", true);
  } else mark("Staff: Demo Lab Technician", false);
  await prisma.branchMembership.upsert({ where: { userId_branchId: { userId: staff.id, branchId: branch.id } }, update: {}, create: { organizationId, userId: staff.id, branchId: branch.id } });
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: staff.id, roleId: role.id } }, update: {}, create: { organizationId, userId: staff.id, roleId: role.id } });

  const notificationTitle = "Demo workspace is ready";
  const notification = await prisma.notification.findFirst({ where: { organizationId, branchId: branch.id, title: notificationTitle } });
  if (!notification) {
    await prisma.notification.create({ data: { organizationId, branchId: branch.id, type: "SYSTEM", title: notificationTitle, message: "Sample patients, tests, orders, inventory and financial records have been added for UI review.", link: "/dashboard" } });
    mark("Notification: Demo workspace is ready", true);
  } else mark("Notification: Demo workspace is ready", false);

  console.log(`\nDemo data prepared for ${organization.name} / ${branch.name}.`);
  console.log(`Created: ${created.length}`);
  for (const item of created) console.log(`  + ${item}`);
  console.log(`Already existed: ${existing.length}`);
  for (const item of existing) console.log(`  = ${item}`);
  console.log("\nThese are real database records, not UI hardcoded placeholders.");
  console.log("Staff directory record is not a login account in this project version.");
}

main()
  .catch((error) => {
    console.error("Demo data setup failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
