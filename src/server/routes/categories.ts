import { zValidator } from '@hono/zod-validator';
import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb, schema } from '../../db/client';
import type { AppEnv } from '../index';
import { getUserActiveCategories } from '../utils/categories';

const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama kategori wajib diisi')
    .max(25, 'Nama kategori maksimal 25 karakter'),
  emoji: z.string().trim().min(1, 'Emoji wajib dipilih').default('💰'),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Format warna harus HEX (#RRGGBB)')
    .default('#10b981')
});

const updateCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama kategori wajib diisi')
    .max(25, 'Nama kategori maksimal 25 karakter')
    .optional(),
  emoji: z.string().trim().min(1).optional(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Format warna harus HEX (#RRGGBB)')
    .optional(),
  sortOrder: z.number().int().optional()
});

export const categoriesRoute = new Hono<AppEnv>()
  // GET /api/categories
  .get('/', async (c) => {
    const db = getDb(c.env.DB);
    const userId = c.get('userId');

    const list = await getUserActiveCategories(db, userId);

    return c.json({
      success: true,
      data: list
    });
  })

  // POST /api/categories
  .post('/', zValidator('json', createCategorySchema), async (c) => {
    const db = getDb(c.env.DB);
    const userId = c.get('userId');
    const body = c.req.valid('json');

    const currentActive = await getUserActiveCategories(db, userId);
    if (currentActive.length >= 8) {
      return c.json(
        {
          success: false,
          error: 'Maksimal 8 kategori aktif per pengguna untuk menjaga kerapian tampilan'
        },
        400
      );
    }

    // Check if category name already exists (case-insensitive)
    const existing = await db
      .select()
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.userId, userId),
          sql`LOWER(${schema.categories.name}) = LOWER(${body.name})`
        )
      )
      .get();

    if (existing) {
      if (existing.isActive === 1) {
        return c.json(
          {
            success: false,
            error: `Kategori "${body.name}" sudah ada`
          },
          400
        );
      }

      // Reactivate previously soft-deleted category
      await db
        .update(schema.categories)
        .set({
          isActive: 1,
          name: body.name,
          emoji: body.emoji,
          color: body.color,
          sortOrder: currentActive.length + 1
        })
        .where(eq(schema.categories.id, existing.id));

      const updated = await db
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.id, existing.id))
        .get();

      return c.json({
        success: true,
        data: updated,
        message: 'Kategori berhasil diaktifkan kembali'
      });
    }

    const inserted = await db
      .insert(schema.categories)
      .values({
        userId,
        name: body.name,
        emoji: body.emoji,
        color: body.color,
        sortOrder: currentActive.length + 1,
        isActive: 1
      })
      .returning()
      .get();

    return c.json(
      {
        success: true,
        data: inserted,
        message: 'Kategori baru berhasil dibuat'
      },
      201
    );
  })

  // PUT /api/categories/:id
  .put('/:id', zValidator('json', updateCategorySchema), async (c) => {
    const db = getDb(c.env.DB);
    const userId = c.get('userId');
    const id = Number(c.req.param('id'));
    const body = c.req.valid('json');

    if (Number.isNaN(id)) {
      return c.json({ success: false, error: 'ID kategori tidak valid' }, 400);
    }

    const target = await db
      .select()
      .from(schema.categories)
      .where(and(eq(schema.categories.id, id), eq(schema.categories.userId, userId)))
      .get();

    if (!target) {
      return c.json({ success: false, error: 'Kategori tidak ditemukan' }, 404);
    }

    // Check name uniqueness if name is changed
    if (body.name && body.name.toLowerCase() !== target.name.toLowerCase()) {
      const duplicate = await db
        .select()
        .from(schema.categories)
        .where(
          and(
            eq(schema.categories.userId, userId),
            sql`LOWER(${schema.categories.name}) = LOWER(${body.name})`,
            sql`${schema.categories.id} != ${id}`
          )
        )
        .get();

      if (duplicate) {
        return c.json({ success: false, error: `Kategori "${body.name}" sudah digunakan` }, 400);
      }

      // Sync budget category name if user renames it
      await db
        .update(schema.budgets)
        .set({ category: body.name })
        .where(and(eq(schema.budgets.userId, userId), eq(schema.budgets.category, target.name)));
    }

    await db
      .update(schema.categories)
      .set({
        name: body.name ?? target.name,
        emoji: body.emoji ?? target.emoji,
        color: body.color ?? target.color,
        sortOrder: body.sortOrder ?? target.sortOrder
      })
      .where(eq(schema.categories.id, id));

    const updated = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.id, id))
      .get();

    return c.json({
      success: true,
      data: updated,
      message: 'Kategori berhasil diperbarui'
    });
  })

  // DELETE /api/categories/:id (Soft-delete)
  .delete('/:id', async (c) => {
    const db = getDb(c.env.DB);
    const userId = c.get('userId');
    const id = Number(c.req.param('id'));

    if (Number.isNaN(id)) {
      return c.json({ success: false, error: 'ID kategori tidak valid' }, 400);
    }

    const target = await db
      .select()
      .from(schema.categories)
      .where(and(eq(schema.categories.id, id), eq(schema.categories.userId, userId)))
      .get();

    if (!target) {
      return c.json({ success: false, error: 'Kategori tidak ditemukan' }, 404);
    }

    // Soft delete to preserve historical transactions
    await db.update(schema.categories).set({ isActive: 0 }).where(eq(schema.categories.id, id));

    return c.json({
      success: true,
      message: 'Kategori berhasil dihapus'
    });
  });
