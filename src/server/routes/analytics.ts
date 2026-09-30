import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb, schema } from '../../db/client';
import type { AppEnv } from '../index';

const analyticsQuerySchema = z.object({
  month: z.string().optional(),
  year: z.string().optional()
});

export const analyticsRoute = new Hono<AppEnv>().get(
  '/',
  zValidator('query', analyticsQuerySchema),
  async (c) => {
    const db = getDb(c.env.DB);
    const userId = c.get('userId');
    const query = c.req.valid('query');
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date()); // YYYY-MM-DD
    const month = query.month || today.slice(0, 7); // YYYY-MM
    const year = query.year || month.slice(0, 4); // YYYY

    // 1. Total this month
    const monthTotalRes = await db
      .select({ total: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)` })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          sql`${schema.transactions.date} LIKE ${`${month}%`}`
        )
      )
      .get();
    const monthTotal = monthTotalRes?.total || 0;

    // 2. Total today
    const todayTotalRes = await db
      .select({ total: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)` })
      .from(schema.transactions)
      .where(
        and(eq(schema.transactions.userId, userId), sql`${schema.transactions.date} = ${today}`)
      )
      .get();
    const todayTotal = todayTotalRes?.total || 0;

    // 3. Category Breakdown for selected month (Donut chart)
    const categoryRows = await db
      .select({
        category: schema.transactions.category,
        total: sql<number>`SUM(${schema.transactions.amount})`
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          sql`${schema.transactions.date} LIKE ${`${month}%`}`
        )
      )
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
      .where(
        and(
          eq(schema.transactions.userId, userId),
          sql`${schema.transactions.date} LIKE ${`${year}%`}`
        )
      )
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
      .where(eq(schema.debts.userId, userId))
      .get();

    // 6. Smart Insights: MoM Comparison, Largest Transaction, Peak Day
    const [selYear, selMonthNum] = month.split('-').map(Number);
    const prevDate = new Date(selYear, selMonthNum - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const fullMonthNames = [
      'Januari',
      'Februari',
      'Maret',
      'April',
      'Mei',
      'Juni',
      'Juli',
      'Agustus',
      'September',
      'Oktober',
      'November',
      'Desember'
    ];
    const prevMonthLabel = `${fullMonthNames[prevDate.getMonth()]} ${prevDate.getFullYear()}`;

    const isCurrentMonth = today.startsWith(month);
    const currentDayStr = today.slice(8, 10);

    let currentPeriodTotal = monthTotal;
    let prevPeriodTotal = 0;

    if (isCurrentMonth) {
      const currPeriodRes = await db
        .select({ total: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)` })
        .from(schema.transactions)
        .where(
          and(
            eq(schema.transactions.userId, userId),
            sql`${schema.transactions.date} >= ${`${month}-01`} AND ${schema.transactions.date} <= ${`${month}-${currentDayStr}`}`
          )
        )
        .get();
      currentPeriodTotal = currPeriodRes?.total || 0;

      const prevPeriodRes = await db
        .select({ total: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)` })
        .from(schema.transactions)
        .where(
          and(
            eq(schema.transactions.userId, userId),
            sql`${schema.transactions.date} >= ${`${prevMonth}-01`} AND ${schema.transactions.date} <= ${`${prevMonth}-${currentDayStr}`}`
          )
        )
        .get();
      prevPeriodTotal = prevPeriodRes?.total || 0;
    } else {
      const prevFullRes = await db
        .select({ total: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)` })
        .from(schema.transactions)
        .where(
          and(
            eq(schema.transactions.userId, userId),
            sql`${schema.transactions.date} LIKE ${`${prevMonth}%`}`
          )
        )
        .get();
      prevPeriodTotal = prevFullRes?.total || 0;
    }

    const diffAmount = currentPeriodTotal - prevPeriodTotal;
    const diffPercentage =
      prevPeriodTotal > 0
        ? Math.round(((currentPeriodTotal - prevPeriodTotal) / prevPeriodTotal) * 100)
        : 0;

    const largestTx = await db
      .select({
        id: schema.transactions.id,
        name: schema.transactions.name,
        amount: schema.transactions.amount,
        category: schema.transactions.category,
        date: schema.transactions.date
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          sql`${schema.transactions.date} LIKE ${`${month}%`}`
        )
      )
      .orderBy(desc(schema.transactions.amount), desc(schema.transactions.id))
      .limit(1)
      .get();

    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const peakDayRow = await db
      .select({
        dayIndex: sql<string>`strftime('%w', ${schema.transactions.date})`,
        count: sql<number>`COUNT(*)`,
        total: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)`
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          sql`${schema.transactions.date} LIKE ${`${month}%`}`
        )
      )
      .groupBy(sql`strftime('%w', ${schema.transactions.date})`)
      .orderBy(sql`COUNT(*) DESC`, sql`SUM(${schema.transactions.amount}) DESC`)
      .limit(1)
      .get();

    const peakDay = peakDayRow
      ? {
          dayName: dayNames[parseInt(peakDayRow.dayIndex, 10)] || 'Sabtu',
          count: peakDayRow.count,
          total: peakDayRow.total
        }
      : null;

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
        },
        insights: {
          mom: {
            currentPeriodTotal,
            prevPeriodTotal,
            diffAmount,
            diffPercentage,
            prevMonthLabel,
            isSameDayCutoff: isCurrentMonth,
            cutoffDay: isCurrentMonth ? parseInt(currentDayStr, 10) : null
          },
          largestTransaction: largestTx || null,
          peakDay
        }
      }
    });
  }
);
