import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ADMIN_ROLE_NAMES, apiContext, resolveWriteTarget } from "@/lib/scope";
import { fail, handleError, json, opt, optUuid, paging, parseBody, req, uuid } from "@/lib/http";
import { usernameTaken } from "@/lib/usernames";
import { passwordField, personName, phoneField, usernameField } from "@/lib/validators";

const staffInclude = {
  userRoles: { select: { role: { select: { id: true, name: true } } } },
  memberships: { select: { branch: { select: { id: true, name: true } } } },
};

export async function GET(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const { scope } = auth.ctx;
    const sp = new URL(request.url).searchParams;
    const { page, pageSize, skip, take } = paging(sp);
    const q = (sp.get("q") || "").trim().slice(0, 100);

    const and = [
      scope.organizationId ? { organizationId: scope.organizationId } : {},
      scope.branchId ? { memberships: { some: { branchId: scope.branchId } } } : {},
      { userRoles: { some: { role: { name: { notIn: ADMIN_ROLE_NAMES } } } } },
    ];
    if (q) and.push({ OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q, mode: "insensitive" } }] });
    const where = { AND: and };

    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        select: { id: true, name: true, username: true, email: true, phone: true, status: true, createdAt: true, organization: { select: { name: true } }, ...staffInclude },
      }),
      prisma.user.count({ where }),
    ]);
    const items = rows.map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      email: u.email.endsWith("@staff.labos.local") ? null : u.email,
      phone: u.phone,
      status: u.status,
      createdAt: u.createdAt,
      organization: u.organization.name,
      role: u.userRoles.map((r) => r.role).filter((r) => !ADMIN_ROLE_NAMES.includes(r.name))[0] || null,
      branch: u.memberships[0]?.branch || null,
    }));
    return json({ items, total, page, pageSize });
  } catch (error) {
    return handleError(error, "Staff list");
  }
}

const schema = z.object({
  branchId: optUuid,
  name: personName("Name"),
  email: z.string().trim().email("Invalid email address.").max(120).nullish().or(z.literal("")).transform((v) => v || null),
  phone: phoneField,
  roleId: uuid,
  username: usernameField,
  password: passwordField,
});

/**
 * A staff member signs in with the username/password set here. After login they only get
 * the modules that the permissions of their role allow (see lib/permissions.js).
 */
export async function POST(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const parsed = await parseBody(request, schema);
    if (parsed.error) return parsed.error;
    const resolved = await resolveWriteTarget(auth.ctx, parsed.data, { branchRequired: true });
    if (resolved.error) return resolved.error;
    const { organizationId, branchId } = resolved.target;

    const role = await prisma.role.findFirst({ where: { id: parsed.data.roleId, organizationId, name: { notIn: ADMIN_ROLE_NAMES }, OR: [{ branchId: null }, { branchId }] }, select: { id: true } });
    if (!role) return fail("Role not found.", 404);

    if (await usernameTaken(parsed.data.username)) return fail("This username is already taken. Choose another one.", 409);
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const email = parsed.data.email?.toLowerCase() || `${crypto.randomUUID()}@staff.labos.local`;

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: parsed.data.name,
          email,
          phone: parsed.data.phone,
          username: parsed.data.username,
          password: passwordHash,
          organization: { connect: { id: organizationId } },
        },
        select: { id: true },
      });
      await tx.branchMembership.create({ data: { organizationId, userId: created.id, branchId } });
      await tx.userRole.create({ data: { organizationId, userId: created.id, roleId: role.id } });
      return created;
    });
    return json({ id: user.id, message: "Staff member added." }, 201);
  } catch (error) {
    return handleError(error, "Staff create", "A staff member with this email already exists.");
  }
}
