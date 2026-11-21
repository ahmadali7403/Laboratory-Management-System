import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { tryEncryptPassword } from "@/lib/credentials-encryption";

const createSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Organization name kam az kam 2 characters ka hona chahiye.")
    .max(120),

  code: z
    .string()
    .trim()
    .min(2)
    .max(24)
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Code mein sirf letters, numbers, hyphen aur underscore use karein.",
    ),

  slug: z.string().trim().max(140).optional().or(z.literal("")),

  email: z
    .string()
    .trim()
    .email("Valid email enter karein.")
    .optional()
    .or(z.literal("")),

  phone: z.string().trim().max(30).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  country: z.string().trim().min(2).max(100).default("Pakistan"),

  username: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Username mein sirf letters, numbers, dot, underscore aur hyphen use karein.",
    ),

  password: z
    .string()
    .min(8, "Password kam az kam 8 characters ka hona chahiye.")
    .max(100),
});

function makeSlug(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET(request) {
  try {
    const admin = await getAdminSession();

    if (!admin) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim();
    const status = searchParams.get("status") || "ALL";

    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
      ];
    }

    if (["ACTIVE", "SUSPENDED", "INACTIVE"].includes(status)) {
      where.status = status;
    }

    const [organizations, total, active, suspended, inactive] =
      await Promise.all([
        prisma.organization.findMany({
          where,
          orderBy: { createdAt: "desc" },
          include: {
            _count: {
              select: {
                branches: true,
                users: true,
              },
            },
          },
        }),

        prisma.organization.count(),

        prisma.organization.count({
          where: { status: "ACTIVE" },
        }),

        prisma.organization.count({
          where: { status: "SUSPENDED" },
        }),

        prisma.organization.count({
          where: { status: "INACTIVE" },
        }),
      ]);

    return NextResponse.json({
      organizations,
      stats: { total, active, suspended, inactive },
    });
  } catch (error) {
    console.error("Organizations GET error:", error);

    return NextResponse.json(
      { message: "Organizations load nahi ho sakin." },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const admin = await getAdminSession();

    if (!admin) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    const parsed = createSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: parsed.error.issues[0]?.message || "Invalid information.",
          errors: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const username = data.username.toLowerCase();
    const slug = makeSlug(data.slug || data.name);

    if (!slug) {
      return NextResponse.json(
        { message: "Organization slug generate nahi ho saka." },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const organization = await prisma.$transaction(
      async (tx) => {
        // 1. Create organization
        const created = await tx.organization.create({
          data: {
            name: data.name,
            code: data.code.toUpperCase(),
            slug,
            email: data.email || null,
            phone: data.phone || null,
            address: data.address || null,
            city: data.city || null,
            country: data.country || "Pakistan",
          },
        });

        // 2. Create organization admin role
        const role = await tx.role.create({
          data: {
            organizationId: created.id,
            name: "ORGANIZATION_ADMIN",
            description:
              "Full access to this organization and all its branches.",
            isSystem: true,
          },
        });

        // 3. Create organization admin user
        const user = await tx.user.create({
          data: {
            name: `${created.name} Admin`,
            username,
            email:
              data.email?.toLowerCase() || `${username}@accounts.labos.local`,
            password: passwordHash,
            passwordEncrypted: tryEncryptPassword(data.password),

            // Connect user with its organization
            organization: {
              connect: {
                id: created.id,
              },
            },

            // Connect organization admin role
            userRoles: {
              create: {
                role: {
                  connect: {
                    id_organizationId: {
                      id: role.id,
                      organizationId: created.id,
                    },
                  },
                },
              },
            },
          },
          select: {
            id: true,
            username: true,
            status: true,
          },
        });

        return {
          ...created,
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
        message: "Organization aur Admin account successfully create ho gaye.",
        organization,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Organizations POST error:", error);

    if (error?.code === "P2002") {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(", ")
        : "";

      const message = target.includes("username")
        ? "Yeh username pehle se use ho raha hai."
        : target.includes("slug")
          ? "Yeh slug pehle se use ho raha hai."
          : target.includes("email")
            ? "Yeh email pehle se use ho rahi hai."
            : "Yeh organization code ya slug pehle se mojood hai.";

      return NextResponse.json({ message }, { status: 409 });
    }

    return NextResponse.json(
      { message: "Organization create nahi ho saki." },
      { status: 500 },
    );
  }
}
