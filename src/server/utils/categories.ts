import { and, asc, eq } from 'drizzle-orm';
import type { getDb } from '../../db/client';
import { schema } from '../../db/client';
import { DEFAULT_CATEGORIES } from '../../db/schema';

export async function ensureUserCategories(db: ReturnType<typeof getDb>, userId: number) {
  const existing = await db
    .select()
    .from(schema.categories)
    .where(eq(schema.categories.userId, userId))
    .all();

  if (existing.length === 0) {
    const toInsert = DEFAULT_CATEGORIES.map((cat, index) => ({
      userId,
      name: cat.name,
      emoji: cat.emoji,
      color: cat.color,
      sortOrder: index + 1,
      isActive: 1
    }));

    for (const item of toInsert) {
      await db.insert(schema.categories).values(item).onConflictDoNothing();
    }

    return await db
      .select()
      .from(schema.categories)
      .where(and(eq(schema.categories.userId, userId), eq(schema.categories.isActive, 1)))
      .orderBy(asc(schema.categories.sortOrder), asc(schema.categories.id))
      .all();
  }

  return existing.filter((c) => c.isActive === 1).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getUserActiveCategories(db: ReturnType<typeof getDb>, userId: number) {
  await ensureUserCategories(db, userId);

  return await db
    .select()
    .from(schema.categories)
    .where(and(eq(schema.categories.userId, userId), eq(schema.categories.isActive, 1)))
    .orderBy(asc(schema.categories.sortOrder), asc(schema.categories.id))
    .all();
}
