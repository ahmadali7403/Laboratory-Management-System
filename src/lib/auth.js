import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { memo } from "@/lib/memo";

const COOKIE_NAME = "labos_admin_session";
const SESSION_DURATION = 60 * 60 * 8; // 8 hours
// Session re-validation against the database is cached briefly per token.
// A deactivated account is therefore locked out within this window.
const VALIDATE_TTL_MS = 30_000;

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET is missing or invalid.");
  }

  return new TextEncoder().encode(secret);
}

export async function createAdminSession(admin) {
  const token = await new SignJWT({
    adminId: admin.id,
    role: admin.role,
    email: admin.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSecretKey());

  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION,
  });
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) return null;

  return memo(`admin:${token}`, VALIDATE_TTL_MS, async () => {
    try {
      const { payload } = await jwtVerify(token, getSecretKey());

      if (!payload.adminId || payload.role !== "SUPER_ADMIN") {
        return null;
      }

      const admin = await prisma.platformAdmin.findUnique({
        where: { id: payload.adminId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
        },
      });

      if (!admin || !admin.isActive || admin.role !== "SUPER_ADMIN") {
        return null;
      }

      return admin;
    } catch {
      return null;
    }
  });
}

export async function destroyAdminSession() {
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

const USER_COOKIE_NAME = "labos_user_session";

export async function createUserSession(user, roleName, branchId = null) {
  const token = await new SignJWT({
    userId: user.id,
    organizationId: user.organizationId,
    branchId,
    role: roleName,
    username: user.username,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(USER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION,
  });
}

export async function getUserSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_COOKIE_NAME)?.value;
  if (!token) return null;

  return memo(`user:${token}`, VALIDATE_TTL_MS, async () => {
    try {
      const { payload } = await jwtVerify(token, getSecretKey());
      if (!payload.userId || !payload.organizationId || !payload.role)
        return null;

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          name: true,
          username: true,
          organizationId: true,
          status: true,
          organization: { select: { status: true } },
          memberships: {
            select: { branchId: true, branch: { select: { status: true } } },
          },
          userRoles: { select: { role: { select: { name: true } } } },
        },
      });

      if (
        !user ||
        user.status !== "ACTIVE" ||
        user.organizationId !== payload.organizationId ||
        user.organization.status !== "ACTIVE"
      )
        return null;

      const roleNames = user.userRoles.map((item) => item.role.name);
      if (!roleNames.includes(payload.role)) return null;

      if (payload.role === "BRANCH_ADMIN") {
        const membership = user.memberships.find(
          (item) =>
            item.branchId === payload.branchId &&
            item.branch.status === "ACTIVE",
        );
        if (!membership) return null;
      }

      return {
        id: user.id,
        name: user.name,
        username: user.username,
        organizationId: user.organizationId,
        branchId: payload.branchId || null,
        role: payload.role,
      };
    } catch {
      return null;
    }
  });
}

export async function destroyUserSession() {
  const cookieStore = await cookies();
  cookieStore.set(USER_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function canManageOrganizationBranches(organizationId) {
  const admin = await getAdminSession();
  if (admin) return true;
  const user = await getUserSession();
  return Boolean(
    user &&
    user.role === "ORGANIZATION_ADMIN" &&
    user.organizationId === organizationId,
  );
}
