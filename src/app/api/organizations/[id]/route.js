import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  code: z
    .string()
    .trim()
    .min(2)
    .max(24)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(140)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  email: z.string().trim().email().nullable().optional().or(z.literal("")),
  phone: z.string().trim().max(30).nullable().optional().or(z.literal("")),
  address: z.string().trim().max(300).nullable().optional().or(z.literal("")),
  city: z.string().trim().max(100).nullable().optional().or(z.literal("")),
  country: z.string().trim().min(2).max(100).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "INACTIVE"]).optional(),
});

export async function PATCH(request, { params }) {
  try {
    const admin = await getAdminSession();

    if (!admin) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    const { id } = await params;

    const parsed = updateSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Invalid information." },
        { status: 400 },
      );
    }

    const data = { ...parsed.data };

    for (const key of ["email", "phone", "address", "city"]) {
      if (data[key] === "") data[key] = null;
    }

    if (data.code) {
      data.code = data.code.toUpperCase();
    }

    const existing = await prisma.organization.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Organization nahi mili." },
        { status: 404 },
      );
    }

    const organization = await prisma.organization.update({
      where: { id },
      data,
      include: {
        _count: {
          select: {
            branches: true,
            users: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: "Organization update ho gayi.",
      organization,
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { message: "Yeh code ya slug kisi doosri organization ke paas hai." },
        { status: 409 },
      );
    }

    console.error("Organizations PATCH error:", error);

    return NextResponse.json(
      { message: "Organization update nahi ho saki." },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const admin = await getAdminSession();

    if (!admin) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    const { id } = await params;

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            branches: true,
            users: true,
            roles: true,
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { message: "Organization nahi mili." },
        { status: 404 },
      );
    }

    const { branches, users, roles } = organization._count;

    if (branches > 0 || users > 0 || roles > 0) {
      return NextResponse.json(
        {
          message:
            "Yeh organization delete nahi ho sakti kyun ke iske saath branches, users ya roles linked hain. Isay suspend kar dein.",
          counts: { branches, users, roles },
        },
        { status: 409 },
      );
    }

    await prisma.organization.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Organization permanently delete ho gayi.",
    });
  } catch (error) {
    console.error("Organizations DELETE error:", error);

    return NextResponse.json(
      { message: "Organization delete nahi ho saki." },
      { status: 500 },
    );
  }
}
