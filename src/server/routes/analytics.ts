import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb, schema } from '../../db/client';
import type { AppEnv } from '../index';
import { getAiQuotaStatus, incrementAiUsage, resolveUserGeminiConfig } from '../utils/aiUsage';

const analyticsQuerySchema = z.object({
  month: z.string().optional(),
  year: z.string().optional()
});

export const analyticsRoute = new Hono<AppEnv>()
  .get('/', zValidator('query', analyticsQuerySchema), async (c) => {
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
  })
  .post(
    '/ai-insight',
    zValidator('json', z.object({ month: z.string().optional() })),
    async (c) => {
      const db = getDb(c.env.DB);
      const userId = c.get('userId');
      const { month: reqMonth } = c.req.valid('json');
      const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(
        new Date()
      ); // YYYY-MM-DD
      const month = reqMonth || today.slice(0, 7); // YYYY-MM

      const modelName = c.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
      const { apiKey, isCustomKey } = await resolveUserGeminiConfig(
        db,
        userId,
        c.env.GEMINI_API_KEY
      );

      if (!apiKey) {
        return c.json(
          {
            success: false,
            error: 'GEMINI_API_KEY belum dikonfigurasi di server maupun di Pengaturan Profil Anda'
          },
          500
        );
      }

      const quota = await getAiQuotaStatus(
        db,
        userId,
        modelName,
        c.env.AI_DAILY_LIMIT,
        isCustomKey
      );
      if (quota.remaining <= 0) {
        return c.json(
          {
            success: false,
            error:
              'Kuota harian AI telah habis. Silakan gunakan Gemini API Key pribadi di Pengaturan Profil.'
          },
          429
        );
      }

      // 1. Gather monthly stats
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

      if (monthTotal === 0) {
        return c.json({
          success: true,
          data: {
            insight:
              'Belum ada transaksi pengeluaran yang tercatat di bulan ini. Yuk mulai catat pengeluaranmu lewat chat cepat atau scan struk agar AI bisa menganalisis kebiasaan finansialmu!',
            month
          }
        });
      }

      // Category breakdown
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

      // MoM comparison
      const [selYear, selMonthNum] = month.split('-').map(Number);
      const prevDate = new Date(selYear, selMonthNum - 2, 1);
      const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      const isCurrentMonth = today.startsWith(month);
      const currentDayStr = today.slice(8, 10);

      const currentPeriodTotal = monthTotal;
      let prevPeriodTotal = 0;

      if (isCurrentMonth) {
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

      const diffPercentage =
        prevPeriodTotal > 0
          ? Math.round(((currentPeriodTotal - prevPeriodTotal) / prevPeriodTotal) * 100)
          : 0;

      // Largest Transaction
      const largestTx = await db
        .select({
          name: schema.transactions.name,
          amount: schema.transactions.amount,
          category: schema.transactions.category
        })
        .from(schema.transactions)
        .where(
          and(
            eq(schema.transactions.userId, userId),
            sql`${schema.transactions.date} LIKE ${`${month}%`}`
          )
        )
        .orderBy(desc(schema.transactions.amount))
        .limit(1)
        .get();

      // Peak Day
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

      const peakDayName = peakDayRow ? dayNames[parseInt(peakDayRow.dayIndex, 10)] : null;

      // Budgets
      const userBudgets = await db
        .select()
        .from(schema.budgets)
        .where(eq(schema.budgets.userId, userId))
        .all();

      const overbudgetList: string[] = [];
      for (const b of userBudgets) {
        const spent = categoryRows.find((c) => c.category === b.category)?.total || 0;
        if (spent > b.monthlyLimit) {
          overbudgetList.push(
            `${b.category} melebihi batas (terpakai Rp ${spent.toLocaleString('id-ID')} dari limit Rp ${b.monthlyLimit.toLocaleString('id-ID')})`
          );
        }
      }

      const financialSummary = {
        bulan: month,
        totalPengeluaran: `Rp ${monthTotal.toLocaleString('id-ID')}`,
        rincianKategori: categoryRows.map(
          (c) =>
            `${c.category}: Rp ${c.total.toLocaleString('id-ID')} (${Math.round((c.total / monthTotal) * 100)}%)`
        ),
        komparasiBulanLalu:
          prevPeriodTotal > 0
            ? `${Math.abs(diffPercentage)}% ${diffPercentage <= 0 ? 'lebih hemat' : 'lebih boros'}`
            : 'Belum ada data bulan lalu',
        transaksiTerbesar: largestTx
          ? `${largestTx.name} (Rp ${largestTx.amount.toLocaleString('id-ID')}, ${largestTx.category})`
          : 'N/A',
        hariPalingKonsumtif: peakDayRow
          ? `Hari ${peakDayName} (${peakDayRow.count}x belanja, total Rp ${peakDayRow.total.toLocaleString('id-ID')})`
          : 'N/A',
        statusBudget:
          overbudgetList.length > 0
            ? overbudgetList.join('; ')
            : 'Semua kategori aman dalam batas budget'
      };

      const systemPrompt = `Kamu adalah Akuntan AI, financial coach dan asisten keuangan pribadi yang ramah, santai, dan solutif.
Tugasmu adalah menganalisis ringkasan data finansial bulanan pengguna dan memberikan evaluasi naratif personal.

Aturan Penulisan:
1. Tulis dalam 2–3 kalimat ringkas (sekitar 40–70 kata).
2. Gunakan sapaan akrab 'kamu' dengan gaya bahasa santai dan bersahabat.
3. Sorot hal paling menonjol dari data (misal: kategori yang mendominasi atau tren vs bulan lalu).
4. Berikan 1 saran taktis konkret yang mudah dilakukan.
5. HANYA kembalikan teks narasi biasa tanpa bullet points atau markdown tebal berlebihan.`;

      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `Berikut ringkasan pengeluaran bulan ini:\n${JSON.stringify(financialSummary, null, 2)}`
                    }
                  ]
                }
              ],
              systemInstruction: { parts: [{ text: systemPrompt }] },
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 250
              }
            })
          }
        );

        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(`Google Gemini HTTP ${res.status}: ${errBody}`);
        }

        type GeminiResponse = {
          candidates?: Array<{
            content?: {
              parts?: Array<{ text?: string }>;
            };
          }>;
          error?: {
            message?: string;
          };
        };

        const geminiData = (await res.json()) as GeminiResponse;
        if (geminiData.error) {
          throw new Error(geminiData.error.message || 'Gemini error');
        }

        const insightText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!insightText) {
          throw new Error('Gemini tidak mengembalikan evaluasi.');
        }

        try {
          await incrementAiUsage(db, userId, modelName);
        } catch (dbErr) {
          console.error('Failed to increment AI usage counter in ai-insight:', dbErr);
        }

        return c.json({
          success: true,
          data: {
            insight: insightText,
            month
          }
        });
      } catch (err) {
        console.error('AI Insight generation error:', err);
        return c.json(
          {
            success: false,
            error: err instanceof Error ? err.message : 'Gagal menghasilkan evaluasi AI'
          },
          500
        );
      }
    }
  );
