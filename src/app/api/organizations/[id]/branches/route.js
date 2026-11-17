import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";

const branchSchema = z.object({
  name: z.string().trim().min(2, "Branch name is required."),
  code: z
    .string()
    .trim()
    .min(2, "Branch code is required.")
    .transform((value) => value.toUpperCase()),
  email: z
    .string()
    .trim()
    .email("Invalid email address.")
    .or(z.literal(""))
    .optional(),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  isHeadOffice: z.boolean().default(false),
});

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// GET: Organization ki branches
export async function GET(request, { params }) {
  try {
    const admin = await getAdminSession();

    if (!admin) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    const { id: organizationId } = await params;

    if (!uuidRegex.test(organizationId)) {
      return NextResponse.json(
        { message: "Invalid organization ID." },
        { status: 400 },
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, status: true },
    });

    if (!organization) {
      return NextResponse.json(
        { message: "Organization not found." },
        { status: 404 },
      );
    }

    const branches = await prisma.branch.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: { memberships: true },
        },
      },
      orderBy: [{ isHeadOffice: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({
      organization,
      branches,
    });
  } catch (error) {
    console.error("GET branches error:", error);

    return NextResponse.json(
      { message: "Unable to load branches." },
      { status: 500 },
    );
  }
}

// POST: New branch create
export async function POST(request, { params }) {
  try {
    const admin = await getAdminSession();

    if (!admin) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    const { id: organizationId } = await params;

    if (!uuidRegex.test(organizationId)) {
      return NextResponse.json(
        { message: "Invalid organization ID." },
        { status: 400 },
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, status: true },
    });

    if (!organization) {
      return NextResponse.json(
        { message: "Organization not found." },
        { status: 404 },
      );
    }

    if (organization.status !== "ACTIVE") {
      return NextResponse.json(
        {
          message:
            "Cannot add branches to an inactive or suspended organization.",
        },
        { status: 409 },
      );
    }

    const body = await request.json();
    const parsed = branchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message:
            parsed.error.issues[0]?.message || "Invalid branch information.",
        },
        { status: 400 },
      );
    }

    const data = parsed.data;

    const branchData = {
      organizationId,
      name: data.name,
      code: data.code,
      email: data.email || null,
      phone: data.phone?.trim() || null,
      address: data.address?.trim() || null,
      city: data.city?.trim() || null,
      isHeadOffice: data.isHeadOffice,
    };

    const branch = await prisma.$transaction(async (tx) => {
      // Organization mein sirf ek head office hoga.
      if (data.isHeadOffice) {
        await tx.branch.updateMany({
          where: { organizationId, isHeadOffice: true },
          data: { isHeadOffice: false },
        });
      }

      return tx.branch.create({
        data: branchData,
      });
    });

    return NextResponse.json(
      {
        message: "Branch created successfully.",
        branch,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { message: "This branch code already exists in this organization." },
        { status: 409 },
      );
    }

    console.error("POST branch error:", error);

    return NextResponse.json(
      { message: "Unable to create branch." },
      { status: 500 },
    );
  }
}
