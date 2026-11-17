import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";

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
            _count: { select: { branches: true, users: true } },
          },
        }),
        prisma.organization.count(),
        prisma.organization.count({ where: { status: "ACTIVE" } }),
        prisma.organization.count({ where: { status: "SUSPENDED" } }),
        prisma.organization.count({ where: { status: "INACTIVE" } }),
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
    const slug = makeSlug(data.slug || data.name);
    if (!slug) {
      return NextResponse.json(
        { message: "Organization slug generate nahi ho saka." },
        { status: 400 },
      );
    }

    const organization = await prisma.organization.create({
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
      include: { _count: { select: { branches: true, users: true } } },
    });

    return NextResponse.json(
      { message: "Organization successfully create ho gayi.", organization },
      { status: 201 },
    );
  } catch (error) {
    if (error?.code === "P2002") {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(", ")
        : "";
      const message = target.includes("slug")
        ? "Yeh slug pehle se use ho raha hai."
        : "Yeh organization code ya slug pehle se mojood hai.";
      return NextResponse.json({ message }, { status: 409 });
    }
    console.error("Organizations POST error:", error);
    return NextResponse.json(
      { message: "Organization create nahi ho saki." },
      { status: 500 },
    );
  }
}
