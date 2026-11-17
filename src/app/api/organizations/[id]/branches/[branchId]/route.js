import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const updateBranchSchema = z.object({
  name: z.string().trim().min(2, "Branch name must contain at least 2 characters.").max(120),
  code: z
    .string()
    .trim()
    .min(2, "Branch code must contain at least 2 characters.")
    .max(24)
    .regex(/^[A-Za-z0-9_-]+$/, "Branch code can contain letters, numbers, hyphens and underscores only.")
    .transform((value) => value.toUpperCase()),
  email: z.string().trim().email("Invalid email address.").or(z.literal("")).optional(),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(100).optional(),
  isHeadOffice: z.boolean().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

async function authorizeAndFindBranch(organizationId, branchId) {
  if (!uuidRegex.test(organizationId) || !uuidRegex.test(branchId)) {
    return { error: NextResponse.json({ message: "Invalid organization or branch ID." }, { status: 400 }) };
  }

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, organizationId },
    select: { id: true, organizationId: true },
  });

  if (!branch) {
    return { error: NextResponse.json({ message: "Branch not found in this organization." }, { status: 404 }) };
  }

  return { branch };
}

export async function PATCH(request, { params }) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    const { id: organizationId, branchId } = await params;
    const result = await authorizeAndFindBranch(organizationId, branchId);
    if (result.error) return result.error;

    const parsed = updateBranchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Invalid branch information." },
        { status: 400 },
      );
    }

    const data = {
      ...parsed.data,
      email: parsed.data.email || null,
      phone: parsed.data.phone?.trim() || null,
      address: parsed.data.address?.trim() || null,
      city: parsed.data.city?.trim() || null,
    };

    const branch = await prisma.$transaction(async (tx) => {
      if (data.isHeadOffice) {
        await tx.branch.updateMany({
          where: { organizationId, id: { not: branchId }, isHeadOffice: true },
          data: { isHeadOffice: false },
        });
      }

      return tx.branch.update({
        where: { id: branchId },
        data,
      });
    });

    return NextResponse.json({ message: "Branch updated successfully.", branch });
  } catch (error) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { message: "This branch code is already used in this organization." },
        { status: 409 },
      );
    }

    console.error("PATCH branch error:", error);
    return NextResponse.json({ message: "Unable to update branch." }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    const { id: organizationId, branchId } = await params;
    const result = await authorizeAndFindBranch(organizationId, branchId);
    if (result.error) return result.error;

    const membershipCount = await prisma.branchMembership.count({
      where: { organizationId, branchId },
    });

    if (membershipCount > 0) {
      return NextResponse.json(
        {
          message: `This branch cannot be deleted because ${membershipCount} user membership(s) are assigned to it. Remove or reassign those memberships first.`,
          membershipCount,
        },
        { status: 409 },
      );
    }

    await prisma.branch.delete({ where: { id: branchId } });

    return NextResponse.json({ message: "Branch deleted successfully." });
  } catch (error) {
    if (error?.code === "P2003") {
      return NextResponse.json(
        { message: "This branch is still linked to other records and cannot be deleted." },
        { status: 409 },
      );
    }

    console.error("DELETE branch error:", error);
    return NextResponse.json({ message: "Unable to delete branch." }, { status: 500 });
  }
}
