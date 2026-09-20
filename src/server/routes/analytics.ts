import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { getDb, schema } from '../../db/client';
import type { Bindings } from '../index';

export const analyticsRoute = new Hono<{ Bindings: Bindings }>().get('/', async (c) => {
  const db = getDb(c.env.DB);
  const month = c.req.query('month') || new Date().toISOString().slice(0, 7); // YYYY-MM
  const year = c.req.query('year') || month.slice(0, 4); // YYYY
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // 1. Total this month
  const monthTotalRes = await db
    .select({ total: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)` })
    .from(schema.transactions)
    .where(sql`${schema.transactions.date} LIKE ${`${month}%`}`)
    .get();
  const monthTotal = monthTotalRes?.total || 0;

  // 2. Total today
  const todayTotalRes = await db
    .select({ total: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)` })
    .from(schema.transactions)
    .where(sql`${schema.transactions.date} = ${today}`)
    .get();
  const todayTotal = todayTotalRes?.total || 0;

  // 3. Category Breakdown for selected month (Donut chart)
  const categoryRows = await db
    .select({
      category: schema.transactions.category,
      total: sql<number>`SUM(${schema.transactions.amount})`
    })
    .from(schema.transactions)
    .where(sql`${schema.transactions.date} LIKE ${`${month}%`}`)
    .groupBy(schema.transactions.category)
    .all();

  const categoryBreakdown = categoryRows.map((r) => ({
    category: r.category,
    total: r.total,
    percentage: monthTotal > 0 ? Math.round((r.total / monthTotal) * 100) : 0
  }));

  // 4. Monthly Trend for selected year (Jan - Dec)
  const trendRows = await db
    .select({
      monthStr: sql<string>`SUBSTR(${schema.transactions.date}, 6, 2)`,
      total: sql<number>`SUM(${schema.transactions.amount})`
    })
    .from(schema.transactions)
    .where(sql`${schema.transactions.date} LIKE ${`${year}%`}`)
    .groupBy(sql`SUBSTR(${schema.transactions.date}, 6, 2)`)
    .all();

  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Mei',
    'Jun',
    'Jul',
    'Agu',
    'Sep',
    'Okt',
    'Nov',
    'Des'
  ];
  const monthlyTrend = monthNames.map((name, idx) => {
    const monthNum = String(idx + 1).padStart(2, '0');
    const found = trendRows.find((r) => r.monthStr === monthNum);
    return {
      month: monthNum,
      label: name,
      total: found ? found.total : 0
    };
  });

  // 5. Total Debts Summary
  const debtSummary = await db
    .select({
      totalOwedToUs: sql<number>`COALESCE(SUM(${schema.debts.totalOwedToUs}), 0)`,
      totalWeOwe: sql<number>`COALESCE(SUM(${schema.debts.totalWeOwe}), 0)`
    })
    .from(schema.debts)
    .get();

  return c.json({
    success: true,
    data: {
      month,
      year,
      monthTotal,
      todayTotal,
      categoryBreakdown,
      monthlyTrend,
      debts: {
        totalOwedToUs: debtSummary?.totalOwedToUs || 0,
        totalWeOwe: debtSummary?.totalWeOwe || 0
      }
    }
  });
});
