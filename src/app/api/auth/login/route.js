import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  createAdminSession,
  createUserSession,
  destroyAdminSession,
  destroyUserSession,
} from "@/lib/auth";
import { checkRateLimit, clearRateLimit, recordRateFailure } from "@/lib/rate-limit";
import { clientIp, logAudit } from "@/lib/audit";

function touchLastLogin(write) {
  Promise.resolve()
    .then(write)
    .catch((error) => console.error("lastLoginAt update failed:", error));
}

export async function POST(request) {
  const ip = clientIp(request);
  try {
    const body = await request.json();
    const mode = body.mode === "pin" ? "pin" : "password";
    const identifier = String(body.identifier || body.email || "")
      .trim()
      .toLowerCase();
    const secret = mode === "pin" ? String(body.pin || "").trim() : String(body.password || "");

    if (!identifier || !secret) {
      return NextResponse.json(
        { message: mode === "pin" ? "Username aur 4-6 digit PIN required hain." : "Username/email aur password required hain." },
        { status: 400 },
      );
    }

    const limitKey = `login:${ip || "local"}:${identifier}`;
    const gate = checkRateLimit(limitKey, { maxAttempts: 10, windowMs: 10 * 60_000 });
    if (!gate.allowed) {
      await logAudit({
        actorName: identifier,
        actorRole: "ANON",
        action: "LOGIN_RATE_LIMITED",
        resource: "AUTH",
        summary: `Login throttled after repeated failed attempts (${identifier})`,
        ip,
      });
      return NextResponse.json(
        { message: `Too many failed login attempts. Try again in ${Math.ceil(gate.retryAfterSec / 60)} minute(s).` },
        { status: 429 },
      );
    }

    if (mode === "pin") {
      if (!/^\d{4,6}$/.test(secret)) {
        return NextResponse.json({ message: "PIN must be 4 to 6 digits." }, { status: 400 });
      }
      const user = await prisma.user.findUnique({
        where: { username: identifier },
        include: {
          organization: { select: { id: true, status: true } },
          memberships: { include: { branch: { select: { id: true, status: true } } } },
          userRoles: { include: { role: true } },
        },
      });
      if (
        !user ||
        user.status !== "ACTIVE" ||
        user.organization.status !== "ACTIVE" ||
        !user.pinHash ||
        !(await bcrypt.compare(secret, user.pinHash))
      ) {
        recordRateFailure(limitKey);
        await logAudit({
          organizationId: user?.organizationId || null,
          userId: user?.id || null,
          actorName: identifier,
          actorRole: "STAFF",
          action: "LOGIN_FAILED",
          resource: "AUTH",
          summary: `Failed PIN login attempt for ${identifier}`,
          ip,
        });
        return NextResponse.json({ message: "Invalid username or PIN." }, { status: 401 });
      }
      clearRateLimit(limitKey);

      const roleNames = user.userRoles.map(({ role }) => role.name);
      const isOrgAdmin = roleNames.includes("ORGANIZATION_ADMIN");
      const isBranchAdmin = roleNames.includes("BRANCH_ADMIN");
      const membership = user.memberships.find((m) => m.branch.status === "ACTIVE");

      if (!isOrgAdmin && !membership) {
        return NextResponse.json({ message: "Aapki assigned branch active nahi hai." }, { status: 403 });
      }
      const sessionRole = isOrgAdmin ? "ORGANIZATION_ADMIN" : isBranchAdmin ? "BRANCH_ADMIN" : "STAFF";
      await destroyAdminSession();
      await createUserSession(user, sessionRole, isOrgAdmin ? null : membership.branchId);
      touchLastLogin(() => prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }));

      await logAudit({
        organizationId: user.organizationId,
        branchId: isOrgAdmin ? null : membership?.branchId || null,
        userId: user.id,
        actorName: user.name,
        actorRole: sessionRole,
        action: "LOGIN_PIN",
        resource: "AUTH",
        summary: `${user.name} signed in using PIN`,
        ip,
      });

      const redirectTo = user.mustChangePassword
        ? "/profile"
        : sessionRole === "ORGANIZATION_ADMIN"
          ? "/organization/dashboard"
          : sessionRole === "BRANCH_ADMIN"
            ? "/branch/dashboard"
            : "/home";

      return NextResponse.json({
        success: true,
        redirectTo,
        accountType: sessionRole,
        mustChangePassword: Boolean(user.mustChangePassword),
      });
    }

    // Password login
    const [admin, user] = await Promise.all([
      prisma.platformAdmin.findFirst({
        where: { OR: [{ email: identifier }, { username: identifier }] },
      }),
      prisma.user.findUnique({
        where: { username: identifier },
        include: {
          organization: { select: { id: true, status: true } },
          memberships: { include: { branch: { select: { id: true, status: true } } } },
          userRoles: { include: { role: true } },
        },
      }),
    ]);

    if (
      admin &&
      admin.isActive &&
      admin.role === "SUPER_ADMIN" &&
      (await bcrypt.compare(secret, admin.password))
    ) {
      clearRateLimit(limitKey);
      await destroyUserSession();
      await createAdminSession(admin);

      touchLastLogin(() =>
        prisma.platformAdmin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } }),
      );
      await logAudit({
        userId: admin.id,
        actorName: admin.name,
        actorRole: "SUPER_ADMIN",
        action: "LOGIN_SUCCESS",
        resource: "AUTH",
        summary: `Super Admin ${admin.name} signed in`,
        ip,
      });

      return NextResponse.json({
        success: true,
        redirectTo: admin.mustChangePassword ? "/profile" : "/dashboard",
        accountType: "SUPER_ADMIN",
        mustChangePassword: Boolean(admin.mustChangePassword),
      });
    }

    if (
      !user ||
      user.status !== "ACTIVE" ||
      user.organization.status !== "ACTIVE" ||
      !(await bcrypt.compare(secret, user.password))
    ) {
      recordRateFailure(limitKey);
      await logAudit({
        organizationId: user?.organizationId || null,
        userId: user?.id || null,
        actorName: identifier,
        actorRole: "USER",
        action: "LOGIN_FAILED",
        resource: "AUTH",
        summary: `Failed password login attempt for ${identifier}`,
        ip,
      });
      return NextResponse.json({ message: "Invalid username ya password." }, { status: 401 });
    }
    clearRateLimit(limitKey);

    const roleNames = user.userRoles.map(({ role }) => role.name);

    if (roleNames.includes("ORGANIZATION_ADMIN")) {
      await destroyAdminSession();
      await createUserSession(user, "ORGANIZATION_ADMIN");
      touchLastLogin(() => prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }));
      await logAudit({
        organizationId: user.organizationId,
        userId: user.id,
        actorName: user.name,
        actorRole: "ORGANIZATION_ADMIN",
        action: "LOGIN_SUCCESS",
        resource: "AUTH",
        summary: `${user.name} signed in (Organization Admin)`,
        ip,
      });

      return NextResponse.json({
        success: true,
        redirectTo: user.mustChangePassword ? "/profile" : "/organization/dashboard",
        accountType: "ORGANIZATION_ADMIN",
        mustChangePassword: Boolean(user.mustChangePassword),
      });
    }

    if (roleNames.includes("BRANCH_ADMIN")) {
      const membership = user.memberships.find((item) => item.branch.status === "ACTIVE");
      if (!membership) {
        return NextResponse.json({ message: "Aapki assigned branch active nahi hai." }, { status: 403 });
      }
      await destroyAdminSession();
      await createUserSession(user, "BRANCH_ADMIN", membership.branchId);
      touchLastLogin(() => prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }));
      await logAudit({
        organizationId: user.organizationId,
        branchId: membership.branchId,
        userId: user.id,
        actorName: user.name,
        actorRole: "BRANCH_ADMIN",
        action: "LOGIN_SUCCESS",
        resource: "AUTH",
        summary: `${user.name} signed in (Branch Admin)`,
        ip,
      });

      return NextResponse.json({
        success: true,
        redirectTo: user.mustChangePassword ? "/profile" : "/branch/dashboard",
        accountType: "BRANCH_ADMIN",
        mustChangePassword: Boolean(user.mustChangePassword),
      });
    }

    if (roleNames.length > 0) {
      const membership = user.memberships.find((item) => item.branch.status === "ACTIVE");
      if (!membership) {
        return NextResponse.json({ message: "Aapki assigned branch active nahi hai." }, { status: 403 });
      }
      await destroyAdminSession();
      await createUserSession(user, "STAFF", membership.branchId);
      touchLastLogin(() => prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }));
      await logAudit({
        organizationId: user.organizationId,
        branchId: membership.branchId,
        userId: user.id,
        actorName: user.name,
        actorRole: roleNames[0] || "STAFF",
        action: "LOGIN_SUCCESS",
        resource: "AUTH",
        summary: `${user.name} signed in (${roleNames.join(", ")})`,
        ip,
      });

      return NextResponse.json({
        success: true,
        redirectTo: "/home",
        accountType: "STAFF",
        mustChangePassword: Boolean(user.mustChangePassword),
      });
    }

    return NextResponse.json(
      { message: "Is account ke liye login role configured nahi hai." },
      { status: 403 },
    );
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ message: "Login process mein error aa gaya." }, { status: 500 });
  }
}
