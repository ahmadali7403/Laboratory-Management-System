import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  getAdminSession,
  getUserSession,
  createAdminSession,
  createUserSession,
} from "@/lib/auth";

function errorResponse(message, status = 400) {
  return NextResponse.json({ message }, { status });
}

function validateProfile(body, existing, requireUsername = false) {
  const name = String(body.name ?? existing.name).trim();

  const email = String(body.email ?? existing.email)
    .trim()
    .toLowerCase();

  const usernameInput =
    body.username === undefined
      ? existing.username
      : String(body.username || "")
          .trim()
          .toLowerCase();

  const username = usernameInput || null;
  const newPassword = String(body.newPassword || "");

  if (name.length < 2 || name.length > 80) {
    return { error: "Name 2 se 80 characters ka hona chahiye." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Valid email address enter karein." };
  }

  if (requireUsername && !username) {
    return { error: "Username required hai." };
  }

  if (username && !/^[a-z0-9._-]{3,30}$/.test(username)) {
    return {
      error:
        "Username 3-30 characters ka ho. Letters, numbers, dot, underscore aur hyphen allowed hain.",
    };
  }

  if (newPassword && newPassword.length < 8) {
    return {
      error: "New password kam az kam 8 characters ka hona chahiye.",
    };
  }

  return { name, email, username, newPassword };
}

async function hasIdentifierConflict(identifiers, options = {}) {
  if (!identifiers.length) return false;

  const { userId, organizationId, adminId } = options;

  const checks = [];

  // Check other platform admins.
  checks.push(
    prisma.platformAdmin.findFirst({
      where: {
        ...(adminId ? { id: { not: adminId } } : {}),
        OR: [{ email: { in: identifiers } }, { username: { in: identifiers } }],
      },
      select: { id: true },
    }),
  );

  if (adminId) {
    // A Platform Admin identifier must not collide with
    // any tenant user's globally unique username.
    checks.push(
      prisma.user.findFirst({
        where: {
          username: { in: identifiers },
        },
        select: { id: true },
      }),
    );
  } else if (userId && organizationId) {
    // Usernames are globally unique.
    // Emails are unique within an organization.
    checks.push(
      prisma.user.findFirst({
        where: {
          id: { not: userId },
          OR: [
            { username: { in: identifiers } },
            {
              email: { in: identifiers },
              organizationId,
            },
          ],
        },
        select: { id: true },
      }),
    );
  }

  const results = await Promise.all(checks);

  return results.some(Boolean);
}

export async function GET() {
  try {
    const adminSession = await getAdminSession();

    if (adminSession) {
      const admin = await prisma.platformAdmin.findUnique({
        where: { id: adminSession.id },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          role: true,
        },
      });

      if (!admin || admin.role !== "SUPER_ADMIN") {
        return errorResponse("Account not found.", 404);
      }

      return NextResponse.json({ profile: admin });
    }

    const userSession = await getUserSession();

    if (!userSession) {
      return errorResponse("Unauthorized.", 401);
    }

    if (!["ORGANIZATION_ADMIN", "BRANCH_ADMIN"].includes(userSession.role)) {
      return errorResponse("Profile access allowed nahi hai.", 403);
    }

    const user = await prisma.user.findFirst({
      where: {
        id: userSession.id,
        organizationId: userSession.organizationId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
      },
    });

    if (!user) {
      return errorResponse("Account not found.", 404);
    }

    return NextResponse.json({
      profile: {
        ...user,
        role: userSession.role,
      },
    });
  } catch (error) {
    console.error("Profile GET error:", error);

    return errorResponse("Profile load nahi ho saka.", 500);
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const currentPassword = String(body.currentPassword || "");

    if (!currentPassword) {
      return errorResponse("Current password required hai.");
    }

    // SUPER ADMIN
    const adminSession = await getAdminSession();

    if (adminSession) {
      const existing = await prisma.platformAdmin.findUnique({
        where: { id: adminSession.id },
      });

      if (!existing || !existing.isActive || existing.role !== "SUPER_ADMIN") {
        return errorResponse("Account not found.", 404);
      }

      const passwordValid = await bcrypt.compare(
        currentPassword,
        existing.password,
      );

      if (!passwordValid) {
        return errorResponse("Current password incorrect hai.");
      }

      const values = validateProfile(body, existing);

      if (values.error) {
        return errorResponse(values.error);
      }

      const { name, email, username, newPassword } = values;
      const identifiers = [email, username].filter(Boolean);

      const conflict = await hasIdentifierConflict(identifiers, {
        adminId: existing.id,
      });

      if (conflict) {
        return errorResponse(
          "Ye username ya email kisi doosre account ke paas already registered hai.",
          409,
        );
      }

      const password = newPassword
        ? await bcrypt.hash(newPassword, 12)
        : existing.password;

      const updated = await prisma.platformAdmin.update({
        where: { id: existing.id },
        data: {
          name,
          username,
          email,
          password,
          ...(newPassword ? { mustChangePassword: false } : {}),
        },
      });

      await createAdminSession(updated);

      return NextResponse.json({
        success: true,
        message: "Profile successfully update ho gayi.",
        profile: {
          id: updated.id,
          name: updated.name,
          username: updated.username,
          email: updated.email,
          role: updated.role,
        },
      });
    }

    // ORGANIZATION ADMIN / BRANCH ADMIN
    const userSession = await getUserSession();

    if (!userSession) {
      return errorResponse("Unauthorized.", 401);
    }

    if (!["ORGANIZATION_ADMIN", "BRANCH_ADMIN"].includes(userSession.role)) {
      return errorResponse("Profile update allowed nahi hai.", 403);
    }

    const existing = await prisma.user.findFirst({
      where: {
        id: userSession.id,
        organizationId: userSession.organizationId,
        status: "ACTIVE",
      },
    });

    if (!existing) {
      return errorResponse("Account not found.", 404);
    }

    const passwordValid = await bcrypt.compare(
      currentPassword,
      existing.password,
    );

    if (!passwordValid) {
      return errorResponse("Current password incorrect hai.");
    }

    const values = validateProfile(body, existing, true);

    if (values.error) {
      return errorResponse(values.error);
    }

    const { name, email, username, newPassword } = values;
    const identifiers = [email, username].filter(Boolean);

    const conflict = await hasIdentifierConflict(identifiers, {
      userId: existing.id,
      organizationId: existing.organizationId,
    });

    if (conflict) {
      return errorResponse(
        "Ye username ya email kisi doosre account ke paas already registered hai.",
        409,
      );
    }

    const password = newPassword
      ? await bcrypt.hash(newPassword, 12)
      : existing.password;

    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        name,
        username,
        email,
        password,
        ...(newPassword ? { mustChangePassword: false } : {}),
      },
    });

    // Refresh session without changing role or branch.
    await createUserSession(updated, userSession.role, userSession.branchId);

    return NextResponse.json({
      success: true,
      message: "Profile successfully update ho gayi.",
      profile: {
        id: updated.id,
        name: updated.name,
        username: updated.username,
        email: updated.email,
        role: userSession.role,
      },
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return errorResponse("Ye username ya email already registered hai.", 409);
    }

    console.error("Profile PATCH error:", error);

    return errorResponse("Profile update nahi ho saki.", 500);
  }
}
