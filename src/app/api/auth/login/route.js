import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createAdminSession, createUserSession, destroyAdminSession, destroyUserSession } from "@/lib/auth";

export async function POST(request) {
  try {
    const body = await request.json();
    const identifier = String(body.identifier || body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!identifier || !password) return NextResponse.json({ message: "Username/email aur password required hain." }, { status: 400 });

    // Super Admin login remains compatible with the existing email-based account.
    const admin = await prisma.platformAdmin.findUnique({ where: { email: identifier } });
    if (admin && admin.isActive && admin.role === "SUPER_ADMIN" && await bcrypt.compare(password, admin.password)) {
      await destroyUserSession();
      await createAdminSession(admin);
      await prisma.platformAdmin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
      return NextResponse.json({ success: true, redirectTo: "/dashboard", accountType: "SUPER_ADMIN" });
    }

    const user = await prisma.user.findUnique({
      where: { username: identifier },
      include: {
        organization: { select: { id: true, status: true } },
        memberships: { include: { branch: { select: { id: true, status: true } } } },
        userRoles: { include: { role: true } },
      },
    });
    if (!user || user.status !== "ACTIVE" || user.organization.status !== "ACTIVE" || !(await bcrypt.compare(password, user.password))) {
      return NextResponse.json({ message: "Invalid username ya password." }, { status: 401 });
    }

    const roleNames = user.userRoles.map(({ role }) => role.name);
    if (roleNames.includes("ORGANIZATION_ADMIN")) {
      await destroyAdminSession();
      await createUserSession(user, "ORGANIZATION_ADMIN");
      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      return NextResponse.json({ success: true, redirectTo: "/organization/dashboard", accountType: "ORGANIZATION_ADMIN" });
    }

    if (roleNames.includes("BRANCH_ADMIN")) {
      const membership = user.memberships.find((item) => item.branch.status === "ACTIVE");
      if (!membership) return NextResponse.json({ message: "Aapki assigned branch active nahi hai." }, { status: 403 });
      await destroyAdminSession();
      await createUserSession(user, "BRANCH_ADMIN", membership.branchId);
      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      return NextResponse.json({ success: true, redirectTo: "/branch/dashboard", accountType: "BRANCH_ADMIN" });
    }

    return NextResponse.json({ message: "Is account ke liye login role configured nahi hai." }, { status: 403 });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ message: "Login process mein error aa gaya." }, { status: 500 });
  }
}
