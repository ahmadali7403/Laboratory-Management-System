// Fills ONE branch with realistic data for every module, for testing.
//   npm run db:seed:branch -- --branch=LHR [--org=ALPHA] [--force]
// --branch : branch code      --org : organization code (needed only if the branch code exists in several organizations)
// Re-running is blocked once demo data exists in that branch (use --force to add another set).
import { pathToFileURL } from "node:url";
import { DEFAULT_TESTS } from "../src/lib/test-defaults-data.mjs";

const MARK = "[DEMO]";
const DAY = 86_400_000;
const num = (v) => (v == null ? null : Number(v));
const mid = (p) =>
  p.refLow != null && p.refHigh != null
    ? (num(p.refLow) + num(p.refHigh)) / 2
    : null;
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

function flagFor(value, p) {
  const text = String(value).trim();
  const n = Number(text);
  if (!Number.isFinite(n) || text === "") {
    const exp = p.refRangeText?.trim();
    return exp &&
      /^(negative|nil|absent|not seen|normal)$/i.test(exp) &&
      text.toLowerCase() !== exp.toLowerCase()
      ? "ABNORMAL"
      : "NORMAL";
  }
  if (p.refLow != null && n < num(p.refLow)) return "LOW";
  if (p.refHigh != null && n > num(p.refHigh)) return "HIGH";
  return "NORMAL";
}
function defaultValue(p, i) {
  const m = mid(p);
  if (m != null) {
    const spread = (num(p.refHigh) - num(p.refLow)) * 0.15;
    return String(round(m + ((i % 3) - 1) * spread, 2));
  }
  if (
    p.refRangeText &&
    /^(negative|nil|absent|not seen)$/i.test(p.refRangeText)
  )
    return p.refRangeText;
  if (p.refRangeText) return p.refRangeText.replace(/^< /, "");
  return /GROUP/i.test(p.name)
    ? "B"
    : /RH/i.test(p.name)
      ? "Positive"
      : "Normal";
}

export async function seedBranch(prisma, branchId, { log = console.log } = {}) {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    include: { organization: true },
  });
  if (!branch) throw new Error("Branch not found.");
  const organizationId = branch.organizationId;
  const base = { organizationId, branchId };
  const now = Date.now();
  const at = (daysAgo, hour = 10) =>
    new Date(now - daysAgo * DAY + (hour - 12) * 3_600_000);
  const counts = {};
  const inc = (k, n = 1) => (counts[k] = (counts[k] || 0) + n);

  async function nextNo(key, prefix) {
    await prisma.sequence.createMany({
      data: [{ organizationId, key, value: 0 }],
      skipDuplicates: true,
    });
    const row = await prisma.sequence.update({
      where: { organizationId_key: { organizationId, key } },
      data: { value: { increment: 1 } },
      select: { value: true },
    });
    return `${prefix}-${String(row.value).padStart(6, "0")}`;
  }

  // ---- catalog (organization-wide starter tests + one branch-only panel) ----
  const have = new Set(
    (
      await prisma.test.findMany({
        where: { organizationId },
        select: { code: true },
      })
    ).map((t) => t.code),
  );
  for (const t of DEFAULT_TESTS) {
    if (have.has(t.code)) continue;
    const { parameters, ...rest } = t;
    await prisma.test.create({
      data: {
        ...rest,
        organizationId,
        branchId: null,
        parameters: {
          create: parameters.map((p, i) => ({ ...p, sortOrder: i })),
        },
      },
    });
    inc("tests");
  }
  const branchCode = `${branch.code}-SP`;
  if (
    !(await prisma.test.findFirst({
      where: { organizationId, code: branchCode },
    }))
  ) {
    await prisma.test.create({
      data: {
        organizationId,
        branchId,
        code: branchCode,
        name: `${branch.name} Special Panel`,
        category: "Biochemistry",
        sampleType: "Blood",
        price: 1800,
        turnaroundHours: 12,
        parameters: {
          create: [
            {
              name: "MAGNESIUM",
              unit: "mg/dL",
              refLow: 1.7,
              refHigh: 2.2,
              sortOrder: 0,
            },
            {
              name: "PHOSPHORUS",
              unit: "mg/dL",
              refLow: 2.5,
              refHigh: 4.5,
              sortOrder: 1,
            },
            {
              name: "LDH",
              unit: "U/L",
              refLow: 140,
              refHigh: 280,
              sortOrder: 2,
            },
          ],
        },
      },
    });
    inc("tests");
  }
  const T = {};
  for (const t of await prisma.test.findMany({
    where: { organizationId, OR: [{ branchId: null }, { branchId }] },
    include: { parameters: { orderBy: { sortOrder: "asc" } } },
  }))
    T[t.code] = t;
  for (const need of [
    "CBC",
    "LFT",
    "RFT",
    "ELEC",
    "LIPID",
    "URDR",
    "INFECT",
    "TFT",
    "DENGUE",
    "FBS",
  ])
    if (!T[need]) throw new Error(`Test ${need} missing.`);

  // ---- doctors / suppliers ----
  const doctors = [];
  for (const d of [
    {
      name: "Dr. Ayesha Khan",
      specialization: "Pathologist",
      phone: "0300-1234567",
      branchId,
    },
    {
      name: "Dr. Imran Malik",
      specialization: "Physician",
      phone: "0321-7654321",
      branchId,
    },
    {
      name: "Dr. Sana Tariq",
      specialization: "Gynecologist",
      phone: "0333-1112223",
      branchId: null,
    },
  ]) {
    doctors.push(
      await prisma.doctor.create({ data: { organizationId, ...d } }),
    );
    inc("doctors");
  }
  const suppliers = [];
  for (const s of [
    {
      name: "MedLab Scientific Supplies",
      contactPerson: "Hassan Raza",
      phone: "0321-5550101",
      email: "orders@medlab.example",
      address: "Lahore",
    },
    {
      name: "Al-Noor Diagnostics Traders",
      contactPerson: "Bilal Ahmed",
      phone: "0300-5550202",
      address: "Karachi",
    },
  ]) {
    suppliers.push(
      await prisma.supplier.create({
        data: { organizationId, branchId, ...s },
      }),
    );
    inc("suppliers");
  }

  // ---- inventory ----
  const inv = {};
  for (const [name, unit, qty, reorder, cost] of [
    ["CBC Reagent Pack", "pack", 14, 5, 6500],
    ["Biochemistry Reagent Kit", "kit", 3, 4, 9800],
    ["Vacutainer Tubes (EDTA)", "box", 22, 10, 1200],
    ["Vacutainer Tubes (Plain)", "box", 4, 8, 1100],
    ["Disposable Syringes 5ml", "box", 30, 10, 650],
    ["Urine Containers", "pack", 18, 6, 400],
    ["Gloves (Medium)", "box", 9, 5, 900],
    ["Hepatitis Rapid Test Kits", "box", 12, 4, 3200],
  ]) {
    inv[name] = await prisma.inventoryItem.create({
      data: {
        ...base,
        name,
        unit,
        quantity: qty,
        reorderLevel: reorder,
        unitCost: cost,
        sku:
          name.slice(0, 3).toUpperCase() +
          "-" +
          Math.floor(100 + Math.random() * 900),
      },
    });
    inc("inventory");
  }
  for (const i of Object.values(inv))
    if (num(i.quantity) <= num(i.reorderLevel))
      await prisma.notification.create({
        data: {
          ...base,
          type: "LOW_STOCK",
          title: "Low stock",
          message: `${i.name} is at or below its reorder level (${num(i.quantity)} ${i.unit}).`,
          link: "/inventory",
          createdAt: at(1),
        },
      });

  // ---- patients ----
  const P = {};
  const people = [
    ["Shahid Amin", "Amin", "MALE", 16, "0303-4354008"],
    ["Fatima Noor", "Noor Ahmed", "FEMALE", 34, "0300-9876543"],
    ["Muhammad Usman", "Abdul Rehman", "MALE", 45, "0312-4455667"],
    ["Ayesha Siddiqui", "Siddique Khan", "FEMALE", 28, "0345-1239876"],
    ["Hamza Ali", "Ali Raza", "MALE", 8, "0301-7778889"],
    ["Zainab Bibi", "Muhammad Tariq", "FEMALE", 61, "0322-5554443"],
    ["Bilal Hussain", "Hussain Shah", "MALE", 39, "0333-2223334"],
    ["Maryam Iqbal", "Iqbal Hussain", "FEMALE", 22, "0310-8889990"],
  ];
  const regDays = [65, 40, 30, 20, 12, 9, 5, 0];
  for (const [
    idx,
    [name, fatherName, gender, age, phone],
  ] of people.entries()) {
    P[name] = await prisma.patient.create({
      data: {
        ...base,
        mrn: await nextNo("patient", "MRN"),
        name,
        fatherName,
        gender,
        phone,
        dateOfBirth: new Date(now - age * 365.25 * DAY),
        cnic: `35202-${Math.floor(1000000 + Math.random() * 8999999)}-${gender === "MALE" ? 1 : 2}`,
        address: `House ${10 + age}, ${branch.city || "Lahore"}`,
        notes: MARK,
        createdAt: at(regDays[idx], 9),
      },
    });
    inc("patients");
  }
  for (const [name, age, gender, phone] of [
    ["Walk-in Rashid", 52, "MALE", "0301-1010101"],
    ["Walk-in Nasreen", 30, "FEMALE", null],
    ["Walk-in Child Ahmed", 6, "MALE", "0302-2020202"],
  ]) {
    P[name] = await prisma.patient.create({
      data: {
        ...base,
        mrn: await nextNo("patient", "MRN"),
        name: name.replace("Walk-in ", ""),
        gender,
        phone,
        isWalkIn: true,
        dateOfBirth: new Date(now - age * 365.25 * DAY),
        notes: MARK,
      },
    });
    inc("patients");
  }

  // ---- orders ----
  // state: how far the workflow went. results: overrides { PARAM: value }
  async function makeOrder({
    patient,
    tests,
    day,
    hour = 10,
    sample = "RECEIVED",
    result = "VERIFIED",
    paid = "full",
    method = "CASH",
    discount = 0,
    doctor = null,
    referredBy = null,
    overrides = {},
    cancelled = false,
    rejectReason = null,
  }) {
    const list = tests.map((c) => T[c]);
    const subtotal = list.reduce((s, t) => s + num(t.price), 0);
    const total = subtotal - discount;
    const payAmount = cancelled
      ? 0
      : paid === "full"
        ? total
        : paid === "partial"
          ? Math.round(total / 2)
          : 0;
    const orderNo = await nextNo("order", "ORD");
    const created = at(day, hour);
    const types = [...new Set(list.map((t) => t.sampleType))];
    const order = await prisma.labOrder.create({
      data: {
        ...base,
        orderNo,
        patientId: patient.id,
        doctorId: doctor?.id || null,
        subtotal,
        discount,
        total,
        paidAmount: payAmount,
        paymentStatus:
          payAmount <= 0 ? "UNPAID" : payAmount >= total ? "PAID" : "PARTIAL",
        referredBy,
        notes: MARK,
        createdByName: "Demo Setup",
        createdAt: created,
        status: cancelled ? "CANCELLED" : "REGISTERED",
        cancelledAt: cancelled ? created : null,
        samples: {
          create: types.map((sampleType, i) => ({
            sampleType,
            sampleNo: `${orderNo}-S${i + 1}`,
            status: cancelled ? "PENDING" : sample,
            collectedAt:
              ["COLLECTED", "RECEIVED"].includes(sample) && !cancelled
                ? at(day, hour + 1)
                : null,
            collectedByName:
              ["COLLECTED", "RECEIVED"].includes(sample) && !cancelled
                ? "Demo Phlebotomist"
                : null,
            rejectionReason: sample === "REJECTED" ? rejectReason : null,
          })),
        },
      },
      include: { samples: true },
    });
    inc("orders");
    const collected = ["COLLECTED", "RECEIVED"].includes(sample) && !cancelled;
    for (const t of list) {
      const item = await prisma.labOrderItem.create({
        data: {
          orderId: order.id,
          testId: t.id,
          sampleId: order.samples.find((s) => s.sampleType === t.sampleType)
            ?.id,
          testName: t.name,
          testCode: t.code,
          price: t.price,
          unit: t.unit,
          results: {
            create: t.parameters.map((p) => ({
              name: p.name,
              unit: p.unit,
              refLow: p.refLow,
              refHigh: p.refHigh,
              refRangeText: p.refRangeText,
              sortOrder: p.sortOrder,
            })),
          },
        },
        include: { results: true },
      });
      if (!collected || result === "PENDING") continue;
      for (const [i, r] of item.results.entries()) {
        const p = t.parameters[i];
        const v = overrides[r.name] ?? defaultValue(p, i);
        await prisma.labResult.update({
          where: { id: r.id },
          data: { value: v, flag: flagFor(v, p) },
        });
      }
      const entered = {
        resultStatus: result,
        enteredByName: "Demo Technician",
        enteredAt: at(day, hour + 2),
      };
      if (result === "VERIFIED")
        Object.assign(entered, {
          verifiedByName: "Dr. Ayesha Khan",
          verifiedAt: at(day, hour + 4),
        });
      await prisma.labOrderItem.update({
        where: { id: item.id },
        data: entered,
      });
    }
    let status = cancelled ? "CANCELLED" : "REGISTERED";
    if (!cancelled)
      status = collected
        ? result === "VERIFIED"
          ? "COMPLETED"
          : result === "ENTERED"
            ? "IN_PROGRESS"
            : "SAMPLE_COLLECTED"
        : "REGISTERED";
    await prisma.labOrder.update({
      where: { id: order.id },
      data: {
        status,
        completedAt: status === "COMPLETED" ? at(day, hour + 4) : null,
      },
    });
    if (payAmount > 0) {
      await prisma.payment.create({
        data: {
          ...base,
          orderId: order.id,
          amount: payAmount,
          method,
          reference:
            method === "CASH"
              ? null
              : `TXN-${Math.floor(10000 + Math.random() * 89999)}`,
          receivedByName: "Demo Cashier",
          createdAt: at(day, hour),
        },
      });
      inc("payments");
    }
    if (status === "COMPLETED")
      await prisma.notification.create({
        data: {
          ...base,
          type: "REPORT_READY",
          title: "Report ready",
          message: `Report for ${patient.name} (${orderNo}) is ready to print.`,
          link: `/reports/${order.id}`,
          isRead: day > 3,
          createdAt: at(day, hour + 4),
        },
      });
    if (sample === "REJECTED")
      await prisma.notification.create({
        data: {
          ...base,
          type: "SAMPLE_REJECTED",
          title: "Sample rejected",
          message: `${orderNo}-S1 was rejected: ${rejectReason}`,
          link: "/samples",
          createdAt: at(day, hour + 1),
        },
      });
    return order;
  }

  const shahid = P["Shahid Amin"];
  // three completed CBCs for one patient (history columns on the report)
  await makeOrder({
    patient: shahid,
    tests: ["CBC"],
    day: 62,
    doctor: doctors[0],
    referredBy: "C.C Siray Mughal",
    overrides: { "WBC COUNT (TLC)": "8.9", MCHC: "32.7" },
  });
  await makeOrder({
    patient: shahid,
    tests: ["CBC", "LFT"],
    day: 30,
    doctor: doctors[0],
    referredBy: "C.C Siray Mughal",
    overrides: { "WBC COUNT (TLC)": "9.4", MCHC: "34.0" },
    method: "CARD",
  });
  await makeOrder({
    patient: shahid,
    tests: ["CBC", "LFT", "RFT", "ELEC", "INFECT"],
    day: 2,
    doctor: doctors[0],
    referredBy: "C.C Siray Mughal",
    overrides: {
      "WBC COUNT (TLC)": "10.6",
      MCHC: "29.8",
      HCT: "44.6",
      "ALKALINE PHOSPHATASE": "345",
    },
    method: "BANK_TRANSFER",
  });
  const fatima = P["Fatima Noor"];
  await makeOrder({
    patient: fatima,
    tests: ["CBC", "TFT", "LIPID"],
    day: 6,
    doctor: doctors[2],
    overrides: {
      "HB (HEMOGLOBIN)": "9.8",
      TSH: "6.9",
      "CHOLESTEROL TOTAL": "248",
      "LDL CHOLESTEROL": "162",
      TRIGLYCERIDES: "210",
    },
  });
  await makeOrder({
    patient: P["Muhammad Usman"],
    tests: ["FBS", "RFT", "LFT"],
    day: 4,
    doctor: doctors[1],
    paid: "partial",
    overrides: {
      "GLUCOSE FASTING": "168",
      "CREATININE (SERUM)": "1.6",
      "UREA (SERUM)": "62",
    },
  });
  await makeOrder({
    patient: P["Ayesha Siddiqui"],
    tests: ["URDR", "CBC"],
    day: 3,
    overrides: { PROTEIN: "Positive (+)", "PUS CELLS": "12", BLOOD: "Trace" },
  });
  await makeOrder({
    patient: P["Hamza Ali"],
    tests: ["CBC", "DENGUE"],
    day: 1,
    doctor: doctors[1],
    result: "ENTERED",
    paid: "partial",
    overrides: { "Platelet Count": "92", "DENGUE NS1 ANTIGEN": "Positive" },
  });
  await makeOrder({
    patient: P["Zainab Bibi"],
    tests: ["LIPID", "FBS"],
    day: 1,
    hour: 11,
    sample: "COLLECTED",
    result: "PENDING",
    paid: "partial",
  });
  await makeOrder({
    patient: P["Bilal Hussain"],
    tests: ["CBC", "ELEC"],
    day: 0,
    hour: 9,
    sample: "PENDING",
    result: "PENDING",
    paid: "none",
  });
  await makeOrder({
    patient: P["Maryam Iqbal"],
    tests: ["URDR"],
    day: 0,
    hour: 9,
    sample: "REJECTED",
    result: "PENDING",
    paid: "partial",
    rejectReason: "Insufficient volume / wrong container",
  });
  await makeOrder({
    patient: P["Bilal Hussain"],
    tests: ["TFT"],
    day: 5,
    cancelled: true,
    paid: "none",
  });
  await makeOrder({
    patient: P["Walk-in Rashid"],
    tests: ["INFECT", "FBS"],
    day: 0,
    hour: 8,
    referredBy: "Self",
    method: "CASH",
  });
  await makeOrder({
    patient: P["Walk-in Nasreen"],
    tests: ["CBC", "ELEC"],
    day: 7,
    discount: 150,
  });
  await makeOrder({
    patient: P["Walk-in Child Ahmed"],
    tests: ["CBC"],
    day: 0,
    hour: 12,
    sample: "RECEIVED",
    result: "PENDING",
    paid: "full",
  });
  if (T[branchCode])
    await makeOrder({
      patient: P["Muhammad Usman"],
      tests: [branchCode],
      day: 9,
      overrides: { MAGNESIUM: "1.4" },
    });
  // extra volume for analytics
  for (const [i, who] of [
    "Fatima Noor",
    "Ayesha Siddiqui",
    "Bilal Hussain",
    "Maryam Iqbal",
    "Zainab Bibi",
    "Hamza Ali",
  ].entries())
    await makeOrder({
      patient: P[who],
      tests: i % 2 ? ["CBC"] : ["LFT", "RFT"],
      day: 10 + i * 3,
      hour: 9 + i,
      method: i % 2 ? "CASH" : "ONLINE",
    });

  // ---- expenses ----
  for (const [category, description, amount, day] of [
    ["Rent", "Monthly branch rent", 85000, 20],
    ["Electricity", "Utility bill", 23800, 15],
    ["Salaries", "Technicians' salaries", 120000, 10],
    ["Consumables", "Gloves, masks, tissue", 6400, 6],
    ["Maintenance", "Analyzer service visit", 12500, 4],
    ["Internet", "Broadband bill", 3500, 2],
  ]) {
    await prisma.expense.create({
      data: {
        ...base,
        category,
        description,
        amount,
        expenseDate: new Date(at(day).toISOString().slice(0, 10)),
        createdByName: "Demo Setup",
      },
    });
    inc("expenses");
  }

  // ---- purchases ----
  const mk = async (status, supplier, lines, day) => {
    const total = lines.reduce((s, [, q, c]) => s + q * c, 0);
    const p = await prisma.purchase.create({
      data: {
        ...base,
        purchaseNo: await nextNo("purchase", "PUR"),
        supplierId: supplier.id,
        status,
        total,
        purchaseDate: new Date(at(day).toISOString().slice(0, 10)),
        notes: MARK,
        createdByName: "Demo Setup",
        receivedAt: status === "RECEIVED" ? at(day) : null,
        items: {
          create: lines.map(([n, q, c]) => ({
            inventoryItemId: inv[n].id,
            quantity: q,
            unitCost: c,
          })),
        },
      },
    });
    inc("purchases");
    if (status === "RECEIVED")
      for (const [n, q, c] of lines)
        await prisma.inventoryItem.update({
          where: { id: inv[n].id },
          data: { quantity: { increment: q }, unitCost: c },
        });
    return p;
  };
  await mk(
    "RECEIVED",
    suppliers[0],
    [
      ["CBC Reagent Pack", 6, 6500],
      ["Vacutainer Tubes (EDTA)", 10, 1200],
    ],
    12,
  );
  await mk(
    "ORDERED",
    suppliers[1],
    [
      ["Biochemistry Reagent Kit", 5, 9800],
      ["Vacutainer Tubes (Plain)", 12, 1100],
    ],
    1,
  );
  await mk("CANCELLED", suppliers[0], [["Gloves (Medium)", 20, 900]], 8);

  // ---- staff directory + role ----
  let role = await prisma.role.findFirst({
    where: { organizationId, name: "Lab Technician" },
  });
  if (!role) {
    await prisma.permission.createMany({
      data: ["patients", "orders", "samples", "results"].flatMap((m) => [
        { key: `${m}.view`, name: `View ${m}` },
        { key: `${m}.manage`, name: `Manage ${m}` },
      ]),
      skipDuplicates: true,
    });
    const perms = await prisma.permission.findMany({
      where: {
        key: {
          in: [
            "patients.view",
            "orders.view",
            "orders.manage",
            "samples.manage",
            "results.manage",
          ],
        },
      },
    });
    role = await prisma.role.create({
      data: {
        organizationId,
        name: "Lab Technician",
        description: "Collects samples and enters results",
        permissions: { create: perms.map((p) => ({ permissionId: p.id })) },
      },
    });
  }
  const rec =
    (await prisma.role.findFirst({
      where: { organizationId, name: "Receptionist" },
    })) ||
    (await prisma.role.create({
      data: {
        organizationId,
        name: "Receptionist",
        description: "Registers patients and takes payments",
      },
    }));
  for (const [name, r, phone] of [
    ["Kamran Ali", role, "0300-1010101"],
    ["Sadia Parveen", role, "0321-2020202"],
    ["Naveed Akhtar", rec, "0333-3030303"],
  ]) {
    const u = await prisma.user.create({
      data: {
        name,
        phone,
        email: `${name.toLowerCase().replace(/\W+/g, ".")}.${Date.now() % 100000}@staff.labos.local`,
        password: "!unusable!",
        organization: { connect: { id: organizationId } },
      },
    });
    await prisma.branchMembership.create({
      data: { organizationId, userId: u.id, branchId },
    });
    await prisma.userRole.create({
      data: { organizationId, userId: u.id, roleId: r.id },
    });
    inc("staff");
  }
  log(
    `Seeded branch "${branch.name}" (${branch.code}) of ${branch.organization.name}:`,
    counts,
  );
  return counts;
}

// ------------------------------- CLI -------------------------------
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const arg = (n) =>
    process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
  const force = process.argv.includes("--force");
  const nextEnv = await import("@next/env");
  const loadEnvConfig = nextEnv.loadEnvConfig || nextEnv.default?.loadEnvConfig;

  if (typeof loadEnvConfig !== "function") {
    throw new Error("Unable to load Next.js environment configuration.");
  }

  loadEnvConfig(process.cwd());
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const code = arg("branch");
    if (!code)
      throw new Error(
        "Usage: npm run db:seed:branch -- --branch=<branch code> [--org=<organization code>] [--force]",
      );
    const rows = await prisma.branch.findMany({
      where: {
        code: { equals: code, mode: "insensitive" },
        ...(arg("org")
          ? {
              organization: {
                code: { equals: arg("org"), mode: "insensitive" },
              },
            }
          : {}),
      },
      include: { organization: true },
    });
    if (rows.length === 0)
      throw new Error(`No branch with code "${code}" found.`);
    if (rows.length > 1)
      throw new Error(
        `Branch code "${code}" exists in ${rows.length} organizations. Add --org=<organization code>.`,
      );
    const branch = rows[0];
    if (branch.status !== "ACTIVE") throw new Error("Branch is not active.");
    if (
      !force &&
      (await prisma.patient.count({
        where: { branchId: branch.id, notes: MARK },
      })) > 0
    )
      throw new Error(
        "Demo data already exists in this branch. Use --force to add another set.",
      );
    await seedBranch(prisma, branch.id);
  } catch (e) {
    console.error("\n" + e.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
