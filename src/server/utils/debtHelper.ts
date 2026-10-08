import { and, eq, sql } from 'drizzle-orm';
import type { getDb } from '../../db/client';
import { schema } from '../../db/client';

export async function adjustDebt(
  db: ReturnType<typeof getDb>,
  userId: number,
  contactName: string,
  deltaOwedToUs: number,
  deltaWeOwe: number
) {
  const contact = contactName.trim().toUpperCase();
  if (!contact) return;

  const existing = await db
    .select()
    .from(schema.debts)
    .where(and(eq(schema.debts.userId, userId), eq(schema.debts.contactName, contact)))
    .get();

  if (existing) {
    const updatedOwed = Math.max(0, existing.totalOwedToUs + deltaOwedToUs);
    const updatedWeOwe = Math.max(0, existing.totalWeOwe + deltaWeOwe);
    await db
      .update(schema.debts)
      .set({
        totalOwedToUs: updatedOwed,
        totalWeOwe: updatedWeOwe,
        updatedAt: sql`CURRENT_TIMESTAMP`
      })
      .where(eq(schema.debts.id, existing.id));
  } else if (deltaOwedToUs > 0 || deltaWeOwe > 0) {
    await db.insert(schema.debts).values({
      userId,
      contactName: contact,
      totalOwedToUs: Math.max(0, deltaOwedToUs),
      totalWeOwe: Math.max(0, deltaWeOwe)
    });
  }
}
