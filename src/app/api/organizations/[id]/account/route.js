import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { isUuid } from "@/lib/http";
import { encryptPassword, decryptPassword } from "@/lib/credentials-encryption";

const schema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3)
      .max(40)
      .regex(/^[a-zA-Z0-9._-]+$/)
      .optional(),
    password: z.string().min(8).max(100).optional(),
  })
  .refine(
    (v) => v.username || v.password,
    "Username ya password provide karein.",
  );

export async function GET(request, { params }) {
  try {
    const admin = await getAdminSession();

    if (!admin) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    const { id: organizationId } = await params;

    if (!isUuid(organizationId)) {
      return NextResponse.json({ message: "Invalid organization ID." }, { status: 400 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });

    if (!organization) {
      return NextResponse.json(
        { message: "Organization not found." },
        { status: 404 },
      );
    }

    const account = await prisma.user.findFirst({
      where: {
        organizationId,
        userRoles: {
          some: {
            role: { name: "ORGANIZATION_ADMIN" },
          },
        },
      },
      select: {
        username: true,
        passwordEncrypted: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { message: "Organization Admin account configured nahi hai." },
        { status: 404 },
      );
    }

    if (!account.passwordEncrypted) {
      return NextResponse.json(
        {
          message:
            "Is account ka existing password encrypted form mein available nahi. Pehle password reset karein.",
        },
        { status: 409 },
      );
    }

    const password = decryptPassword(account.passwordEncrypted);

    return NextResponse.json(
      {
        username: account.username,
        password,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      },
    );
  } catch (error) {
    console.error("Organization password reveal:", error);

    return NextResponse.json(
      { message: "Password retrieve nahi ho saka." },
      { status: 500 },
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    if (!(await getAdminSession())) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    const { id: organizationId } = await params;

    if (!isUuid(organizationId)) {
      return NextResponse.json({ message: "Invalid organization ID." }, { status: 400 });
    }

    const parsed = schema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: parsed.error.issues[0]?.message || "Invalid input.",
        },
        { status: 400 },
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, email: true },
    });

    if (!organization) {
      return NextResponse.json(
        { message: "Organization not found." },
        { status: 404 },
      );
    }

    const account = await prisma.user.findFirst({
      where: {
        organizationId,
        userRoles: {
          some: {
            role: { name: "ORGANIZATION_ADMIN" },
          },
        },
      },
      select: { id: true },
    });

    const data = {};

    if (parsed.data.username) {
      data.username = parsed.data.username.toLowerCase();
    }

    if (parsed.data.password) {
      data.password = await bcrypt.hash(parsed.data.password, 12);
      data.passwordEncrypted = encryptPassword(parsed.data.password);
    }

    let updated;

    if (account) {
      updated = await prisma.user.update({
        where: { id: account.id },
        data,
        select: {
          username: true,
          updatedAt: true,
        },
      });
    } else {
      if (!parsed.data.username || !parsed.data.password) {
        return NextResponse.json(
          {
            message:
              "Account abhi configured nahi. Username aur password dono provide karein.",
          },
          { status: 400 },
        );
      }

      const passwordHash = await bcrypt.hash(parsed.data.password, 12);

      updated = await prisma.$transaction(async (tx) => {
        const role = await tx.role.upsert({
          where: {
            organizationId_name: {
              organizationId,
              name: "ORGANIZATION_ADMIN",
            },
          },
          update: {},
          create: {
            organizationId,
            name: "ORGANIZATION_ADMIN",
            description: "Full access to this organization and its branches.",
            isSystem: true,
          },
        });

        return tx.user.create({
          data: {
            organizationId,
            name: `${organization.name} Admin`,
            username: parsed.data.username.toLowerCase(),
            email:
              organization.email?.toLowerCase() ||
              `${parsed.data.username.toLowerCase()}@accounts.labos.local`,
            password: passwordHash,
            passwordEncrypted: encryptPassword(parsed.data.password),
            userRoles: {
              create: {
                organizationId,
                roleId: role.id,
              },
            },
          },
          select: {
            username: true,
            updatedAt: true,
          },
        });
      });
    }

    return NextResponse.json({
      message: "Organization account updated.",
      account: updated,
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { message: "Yeh username ya email pehle se use ho raha hai." },
        { status: 409 },
      );
    }

    console.error("Organization account update:", error);

    return NextResponse.json(
      { message: "Account update nahi ho saka." },
      { status: 500 },
    );
  }
}
