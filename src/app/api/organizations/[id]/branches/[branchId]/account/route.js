import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { canManageOrganizationBranches } from "@/lib/auth";
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
    const { id: organizationId, branchId } = await params;

    if (!isUuid(organizationId) || !isUuid(branchId)) {
      return NextResponse.json({ message: "Invalid organization or branch ID." }, { status: 400 });
    }

    if (!(await canManageOrganizationBranches(organizationId))) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    const branch = await prisma.branch.findFirst({
      where: { id: branchId, organizationId },
      select: { id: true },
    });

    if (!branch) {
      return NextResponse.json(
        { message: "Branch not found." },
        { status: 404 },
      );
    }

    const membership = await prisma.branchMembership.findFirst({
      where: {
        organizationId,
        branchId,
        user: {
          userRoles: {
            some: {
              role: { name: "BRANCH_ADMIN" },
            },
          },
        },
      },
      select: {
        user: {
          select: {
            username: true,
            passwordEncrypted: true,
          },
        },
      },
    });

    if (!membership?.user) {
      return NextResponse.json(
        { message: "Branch Admin account configured nahi hai." },
        { status: 404 },
      );
    }

    if (!membership.user.passwordEncrypted) {
      return NextResponse.json(
        {
          message:
            "Is account ka existing password encrypted form mein available nahi. Pehle password reset karein.",
        },
        { status: 409 },
      );
    }

    const password = decryptPassword(membership.user.passwordEncrypted);

    return NextResponse.json(
      {
        username: membership.user.username,
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
    console.error("Branch password reveal:", error);

    return NextResponse.json(
      { message: "Password retrieve nahi ho saka." },
      { status: 500 },
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id: organizationId, branchId } = await params;

    if (!isUuid(organizationId) || !isUuid(branchId)) {
      return NextResponse.json({ message: "Invalid organization or branch ID." }, { status: 400 });
    }

    if (!(await canManageOrganizationBranches(organizationId))) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
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

    const branch = await prisma.branch.findFirst({
      where: { id: branchId, organizationId },
      select: { id: true, name: true, status: true },
    });

    if (!branch) {
      return NextResponse.json(
        { message: "Branch not found." },
        { status: 404 },
      );
    }

    const membership = await prisma.branchMembership.findFirst({
      where: {
        organizationId,
        branchId,
        user: {
          userRoles: {
            some: {
              role: { name: "BRANCH_ADMIN" },
            },
          },
        },
      },
      select: { userId: true },
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

    if (membership) {
      updated = await prisma.user.update({
        where: { id: membership.userId },
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
              "Branch Admin account abhi configured nahi. Username aur password dono provide karein.",
          },
          { status: 400 },
        );
      }

      if (branch.status !== "ACTIVE") {
        return NextResponse.json(
          {
            message: "Inactive branch ke liye account create nahi ho sakta.",
          },
          { status: 409 },
        );
      }

      const passwordHash = await bcrypt.hash(parsed.data.password, 12);

      updated = await prisma.$transaction(async (tx) => {
        const role = await tx.role.upsert({
          where: {
            organizationId_name: {
              organizationId,
              name: "BRANCH_ADMIN",
            },
          },
          update: {},
          create: {
            organizationId,
            name: "BRANCH_ADMIN",
            description: "Access limited to assigned branch.",
            isSystem: true,
          },
        });

        return tx.user.create({
          data: {
            organizationId,
            name: `${branch.name} Admin`,
            username: parsed.data.username.toLowerCase(),
            email: `${parsed.data.username.toLowerCase()}@accounts.labos.local`,
            password: passwordHash,
            passwordEncrypted: encryptPassword(parsed.data.password),
            memberships: {
              create: {
                organizationId,
                branchId,
              },
            },
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
      message: "Branch account updated.",
      account: updated,
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { message: "Yeh username pehle se use ho raha hai." },
        { status: 409 },
      );
    }

    console.error("Branch account update:", error);

    return NextResponse.json(
      { message: "Branch account update nahi ho saka." },
      { status: 500 },
    );
  }
}
