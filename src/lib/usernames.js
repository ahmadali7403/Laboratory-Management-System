import { prisma } from "@/lib/prisma";

/** Usernames are global (login looks them up across users and platform admins). */
export async function usernameTaken(username, exceptUserId = null) {
  const [u, a] = await Promise.all([
    prisma.user.findFirst({ where: { username, ...(exceptUserId ? { id: { not: exceptUserId } } : {}) }, select: { id: true } }),
    prisma.platformAdmin.findFirst({ where: { OR: [{ username }, { email: username }] }, select: { id: true } }),
  ]);
  return Boolean(u || a);
}
