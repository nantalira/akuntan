import { and, eq, sql } from 'drizzle-orm';
import type { getDb } from '../../db/client';
import { schema } from '../../db/client';

/**
 * Prepares an atomic debt adjustment statement for Drizzle db.batch([...]).
 * Returns null if no operation is needed.
 */
export async function getDebtAdjustmentStatement(
  db: ReturnType<typeof getDb>,
  userId: number,
  contactName: string,
  deltaOwedToUs: number,
  deltaWeOwe: number
) {
  const contact = contactName.trim().toUpperCase();
  if (!contact) return null;

  const existing = await db
    .select()
    .from(schema.debts)
    .where(and(eq(schema.debts.userId, userId), eq(schema.debts.contactName, contact)))
    .get();

  if (existing) {
    const updatedOwed = Math.max(0, existing.totalOwedToUs + deltaOwedToUs);
    const updatedWeOwe = Math.max(0, existing.totalWeOwe + deltaWeOwe);
    return db
      .update(schema.debts)
      .set({
        totalOwedToUs: updatedOwed,
        totalWeOwe: updatedWeOwe,
        updatedAt: sql`CURRENT_TIMESTAMP`
      })
      .where(eq(schema.debts.id, existing.id));
  }

  if (deltaOwedToUs > 0 || deltaWeOwe > 0) {
    return db.insert(schema.debts).values({
      userId,
      contactName: contact,
      totalOwedToUs: Math.max(0, deltaOwedToUs),
      totalWeOwe: Math.max(0, deltaWeOwe)
    });
  }

  return null;
}

/**
 * Standalone debt adjuster (wraps getDebtAdjustmentStatement).
 */
export async function adjustDebt(
  db: ReturnType<typeof getDb>,
  userId: number,
  contactName: string,
  deltaOwedToUs: number,
  deltaWeOwe: number
) {
  const stmt = await getDebtAdjustmentStatement(db, userId, contactName, deltaOwedToUs, deltaWeOwe);
  if (stmt) {
    await stmt;
  }
}
