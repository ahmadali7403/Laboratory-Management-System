import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { canManageOrganizationBranches } from "@/lib/auth";
import { tryEncryptPassword } from "@/lib/credentials-encryption";

const branchSchema = z.object({
  name: z.string().trim().min(2, "Branch name is required."),
  code: z
    .string()
    .trim()
    .min(2, "Branch code is required.")
    .max(24)
    .regex(/^[A-Za-z0-9_-]+$/)
    .transform((value) => value.toUpperCase()),
  email: z
    .string()
    .trim()
    .email("Invalid email address.")
    .or(z.literal(""))
    .optional(),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(100).optional(),
  isHeadOffice: z.boolean().default(false),
  username: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(8).max(100),
});

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// GET: Organization ki branches
export async function GET(request, { params }) {
  try {
    const { id: organizationId } = await params;

    if (!uuidRegex.test(organizationId)) {
      return NextResponse.json(
        { message: "Invalid organization ID." },
        { status: 400 },
      );
    }

    if (!(await canManageOrganizationBranches(organizationId))) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        status: true,
      },
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
          select: {
            memberships: true,
          },
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

// POST: New branch + Branch Admin account create
export async function POST(request, { params }) {
  try {
    const { id: organizationId } = await params;

    if (!uuidRegex.test(organizationId)) {
      return NextResponse.json(
        { message: "Invalid organization ID." },
        { status: 400 },
      );
    }

    if (!(await canManageOrganizationBranches(organizationId))) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        status: true,
      },
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

    const parsed = branchSchema.safeParse(await request.json());

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
    const username = data.username.toLowerCase();

    const passwordHash = await bcrypt.hash(data.password, 12);

    const result = await prisma.$transaction(
      async (tx) => {
        // Agar new branch head office hai to purana head office remove karo.
        if (data.isHeadOffice) {
          await tx.branch.updateMany({
            where: {
              organizationId,
              isHeadOffice: true,
            },
            data: {
              isHeadOffice: false,
            },
          });
        }

        // Branch create
        const branch = await tx.branch.create({
          data: {
            organizationId,
            name: data.name,
            code: data.code,
            email: data.email || null,
            phone: data.phone?.trim() || null,
            address: data.address?.trim() || null,
            city: data.city?.trim() || null,
            isHeadOffice: data.isHeadOffice,
          },
        });

        // Organization ka Branch Admin role
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

        // Branch Admin user create
        const user = await tx.user.create({
          data: {
            name: `${branch.name} Admin`,
            username,
            email: `${username}@accounts.labos.local`,
            password: passwordHash,
            passwordEncrypted: tryEncryptPassword(data.password),
            organization: {
              connect: {
                id: organizationId,
              },
            },
          },
          select: {
            id: true,
            username: true,
            status: true,
          },
        });

        // User ko branch ke saath assign karo
        await tx.branchMembership.create({
          data: {
            organizationId,
            userId: user.id,
            branchId: branch.id,
          },
        });

        // User ko Branch Admin role assign karo
        await tx.userRole.create({
          data: {
            organizationId,
            userId: user.id,
            roleId: role.id,
          },
        });

        return {
          ...branch,
          account: user,
        };
      },
      {
        maxWait: 10000,
        timeout: 30000,
      },
    );

    return NextResponse.json(
      {
        message: "Branch aur Branch Admin account successfully create ho gaye.",
        branch: result,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error?.code === "P2002") {
      const target = error.meta?.target;

      const isUsernameConflict = Array.isArray(target)
        ? target.includes("username")
        : String(target || "").includes("username");

      return NextResponse.json(
        {
          message: isUsernameConflict
            ? "Yeh username pehle se use ho raha hai."
            : "This branch code already exists in this organization.",
        },
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
