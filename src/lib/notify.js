export async function notify(tx, { organizationId, branchId = null, type, title, message, link = null }) {
  await tx.notification.create({
    data: { organizationId, branchId, type, title, message, link },
  });
}
