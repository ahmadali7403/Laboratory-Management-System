import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { memo } from "@/lib/memo";

const COOKIE_NAME = "labos_admin_session";
const SESSION_DURATION = 60 * 60 * 24 * 7; // 7 days (renewed automatically while the app is open)
const REFRESH_AFTER_SECONDS = 60 * 60; // re-issue the cookie when it is older than 1 hour
// Session re-validation against the database is cached briefly per token.
// A deactivated account is therefore locked out within this window.
const VALIDATE_TTL_MS = 30_000;

const cookieSecure = () =>
  process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false";

/**
 * Database lookups can fail for a moment (Neon cold start, network blip).
 * That must NEVER look like "invalid session" (which signs the user out), so we
 * retry and then throw - memo() does not cache a thrown error.
 */
async function withRetry(fn, attempts = 3) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      await new Promise((r) => setTimeout(r, 250 * (i + 1)));
    }
  }
  throw last;
}

async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload;
  } catch {
    return null; // bad signature / expired token = really signed out
  }
}

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
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION,
  });
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload || !payload.adminId || payload.role !== "SUPER_ADMIN") return null;

  return memo(`admin:${token}`, VALIDATE_TTL_MS, async () => {
    const admin = await withRetry(() =>
      prisma.platformAdmin.findUnique({
        where: { id: payload.adminId },
        select: { id: true, name: true, email: true, role: true, isActive: true },
      }),
    );
    if (!admin || !admin.isActive || admin.role !== "SUPER_ADMIN") return null;
    return admin;
  });
}

export async function destroyAdminSession() {
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: cookieSecure(),
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
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION,
  });
}

export async function getUserSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload || !payload.userId || !payload.organizationId || !payload.role)
    return null;

  return memo(`user:${token}`, VALIDATE_TTL_MS, async () => {
    const user = await withRetry(() =>
      prisma.user.findUnique({
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
      }),
    );

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
          item.branchId === payload.branchId && item.branch.status === "ACTIVE",
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
  });
}

export async function destroyUserSession() {
  const cookieStore = await cookies();
  cookieStore.set(USER_COOKIE_NAME, "", {
    httpOnly: true,
    secure: cookieSecure(),
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

/**
 * Sliding session: called by the app while it is open. A still-valid session whose
 * cookie is older than REFRESH_AFTER_SECONDS gets a fresh 7-day cookie.
 * Returns true when the session is valid, false when the person is really signed out.
 */
export async function refreshSession() {
  const cookieStore = await cookies();
  for (const name of [COOKIE_NAME, USER_COOKIE_NAME]) {
    const token = cookieStore.get(name)?.value;
    if (!token) continue;
    const payload = await verifyToken(token);
    if (!payload) continue;
    const valid = name === COOKIE_NAME ? await getAdminSession() : await getUserSession();
    if (!valid) return false;
    const age = Math.floor(Date.now() / 1000) - (payload.iat || 0);
    if (age > REFRESH_AFTER_SECONDS) {
      const { exp, iat, ...claims } = payload; // eslint-disable-line no-unused-vars
      const fresh = await new SignJWT(claims)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(`${SESSION_DURATION}s`)
        .sign(getSecretKey());
      cookieStore.set(name, fresh, {
        httpOnly: true,
        secure: cookieSecure(),
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_DURATION,
      });
    }
    return true;
  }
  return false;
}
