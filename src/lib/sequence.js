/**
 * Per-organization running numbers (MRN-000001, ORD-000001 ...).
 * Must be called inside a prisma.$transaction. The UPDATE takes a row lock, so
 * concurrent requests are serialised and never receive the same number.
 */
export async function nextNumber(tx, organizationId, key, prefix, pad = 6) {
  await tx.sequence.createMany({
    data: [{ organizationId, key, value: 0 }],
    skipDuplicates: true,
  });
  const row = await tx.sequence.update({
    where: { organizationId_key: { organizationId, key } },
    data: { value: { increment: 1 } },
    select: { value: true },
  });
  return `${prefix}-${String(row.value).padStart(pad, "0")}`;
}
