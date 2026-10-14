import { zValidator } from '@hono/zod-validator';
import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb, schema } from '../../db/client';
import type { AppEnv } from '../index';
import { consumeAiQuotaAtomic, resolveUserGeminiConfig } from '../utils/aiQuota';
import { getUserActiveCategories } from '../utils/categories';
import { getDebtAdjustmentStatement } from '../utils/debtHelper';
import { detectPaymentMethod, toMonetaryInteger } from '../utils/paymentParser';
import { getCurrentDateAndTimeInTimezone, resolveUserTimezone } from '../utils/timezone';

interface GeminiParsedResponse {
  action: 'expense' | 'settlement' | 'split_bill' | 'general';
  name?: string;
  amount?: number;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm:ss
  category?: string;
  payment_method?: string;
  debtor?: string;
  creditor?: string;
  debt_amount?: number;
  notes?: string;
  reply: string;
}

const chatMessageSchema = z.object({
  message: z.string().trim().min(1, 'Pesan tidak boleh kosong')
});

export const chatRoute = new Hono<AppEnv>().post(
  '/',
  zValidator('json', chatMessageSchema),
  async (c) => {
    const db = getDb(c.env.DB);
    const userId = c.get('userId');
    const { message } = c.req.valid('json');

    // Stateless user timezone from header (fallback: Asia/Jakarta)
    const userTimezone = resolveUserTimezone(c.req.header('X-User-Timezone'));
    const { date: todayStr, time: currentTimeStr } = getCurrentDateAndTimeInTimezone(userTimezone);

    const userCats = await getUserActiveCategories(db, userId);
    const catNames = userCats.map((c) => c.name);
    const catNamesFormatted = catNames.map((n) => `"${n}"`).join(', ');
    const catListPrompt = userCats.map((c) => `- ${c.name} (${c.emoji})`).join('\n');

    const { apiKey } = await resolveUserGeminiConfig(db, userId, c.env.GEMINI_API_KEY);
    let parsed: GeminiParsedResponse;
    let inputSource: 'ai' | 'local_parser' = 'local_parser';

    if (apiKey) {
      const modelName = c.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
      const quotaResult = await consumeAiQuotaAtomic(db, userId, {
        modelName,
        overrideLimit: c.env.AI_DAILY_LIMIT,
        serverApiKey: c.env.GEMINI_API_KEY
      });

      if (!quotaResult.allowed) {
        console.warn(
          `AI Quota reached limit for user ${userId} (${quotaResult.used}/${quotaResult.limit}), falling back to local parser`
        );
        parsed = fallbackLocalParser(message, todayStr, currentTimeStr, userCats);
      } else {
        try {
          const systemInstruction = `Kamu adalah Akuntan AI, asisten pencatatan pengeluaran pribadi berbahasa Indonesia yang cerdas dan teliti.
Hari ini adalah: ${todayStr}, jam saat ini: ${currentTimeStr} (WIB).

Tugasmu adalah menganalisis pesan santai pengguna tentang pengeluaran, hutang, patungan, atau pelunasan, lalu mengembalikan JSON terstruktur.
Kategori transaksi WAJIB persis salah satu dari pos pengguna berikut: [${catNamesFormatted}].
Daftar Pos Pengeluaran Pengguna:
${catListPrompt}

Aturan Deteksi Hutang / Split Bill:
1. "nalangi [nama] [item] [harga]" -> debtor: [nama dalam HURUF BESAR], debt_amount: [harga yang ditalangi].
2. "beli [item] [harga] ditalangi [nama]" -> creditor: [nama dalam HURUF BESAR], debt_amount: [harga yang ditalangi].
3. "patungan [item] [total] berdua sama [nama], [dia] yang bayar" -> action: "split_bill", amount: [total/2], creditor: [nama], debt_amount: [total/2].
4. "patungan [item] [total] berdua sama [nama], [aku] yang bayar" -> action: "split_bill", amount: [total/2], debtor: [nama], debt_amount: [total/2].
5. "bayar hutang [nama] [nominal]" -> action: "settlement", creditor: [nama], amount: [nominal].

Deteksi Waktu (Backdating):
- "kemarin" -> kurangi tanggal 1 hari.
- "pagi" -> time: "07:00:00", "siang" -> time: "12:00:00", "sore" -> time: "17:00:00", "malam" -> time: "20:00:00". Jika tidak disebut waktu, gunakan jam saat ini: ${currentTimeStr}.

Kembalikan format JSON:
{
  "action": "expense" | "settlement" | "split_bill" | "general",
  "name": "nama transaksi ringkas",
  "amount": number (integer positif),
  "date": "YYYY-MM-DD",
  "time": "HH:mm:ss",
  "category": ${catNamesFormatted || '"Makan"'},
  "debtor": "nama yang ditalangi atau kosong",
  "creditor": "nama yang menalangi atau kosong",
  "debt_amount": number,
  "notes": "rincian barang kasir jika ada atau kosong",
  "reply": "kalimat konfirmasi ramah dalam bahasa Indonesia merangkum apa yang dicatat"
}`;

          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: message }] }],
                systemInstruction: { parts: [{ text: systemInstruction }] },
                generationConfig: {
                  responseMimeType: 'application/json',
                  temperature: 0.1
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
          };
          const data = (await res.json()) as GeminiResponse;
          const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (textContent) {
            parsed = JSON.parse(textContent);
            inputSource = 'ai';
          } else {
            throw new Error('Empty Gemini response content');
          }
        } catch (err) {
          console.error('Gemini API error, falling back to local heuristic:', err);
          inputSource = 'local_parser';
          parsed = fallbackLocalParser(message, todayStr, currentTimeStr, userCats);
        }
      }
    } else {
      inputSource = 'local_parser';
      parsed = fallbackLocalParser(message, todayStr, currentTimeStr, userCats);
    }

    // Normalize category to user's active categories
    if (parsed.category) {
      const match = userCats.find((c) => c.name.toLowerCase() === parsed.category?.toLowerCase());
      parsed.category = match ? match.name : userCats[0]?.name || 'Makan';
    } else {
      parsed.category = userCats[0]?.name || 'Makan';
    }

    // If general chat / greeting
    if (parsed.action === 'general' || !parsed.name || !parsed.amount) {
      return c.json({
        success: true,
        recorded: false,
        reply:
          parsed.reply ||
          'Halo! Ketik pengeluaranmu, contoh: "Makan soto 15k", "Bensin 30rb motor", atau "Nalangi Dian 20rb".'
      });
    }

    // Handle Settlement
    if (parsed.action === 'settlement' && parsed.creditor) {
      const contact = parsed.creditor.trim().toUpperCase();
      const existing = await db
        .select()
        .from(schema.debts)
        .where(and(eq(schema.debts.userId, userId), eq(schema.debts.contactName, contact)))
        .get();
      if (existing) {
        const newDebt = Math.max(0, existing.totalWeOwe - parsed.amount);
        await db
          .update(schema.debts)
          .set({ totalWeOwe: newDebt, updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(eq(schema.debts.id, existing.id));
      }
      return c.json({
        success: true,
        recorded: true,
        type: 'settlement',
        reply: `Pelunasan hutang ke ${contact} sebesar Rp ${parsed.amount.toLocaleString('id-ID')} berhasil dicatat! Sisa hutangmu ke ${contact} telah diperbarui.`
      });
    }

    const detectedMethod = parsed.payment_method || detectPaymentMethod(message, 'Cash');
    const integerAmount = toMonetaryInteger(parsed.amount);
    const integerDebtAmount = parsed.debt_amount ? toMonetaryInteger(parsed.debt_amount) : 0;

    // Insert transaction statement
    const insertTxStmt = db
      .insert(schema.transactions)
      .values({
        userId,
        name: parsed.name,
        amount: integerAmount,
        date: parsed.date || todayStr,
        time: parsed.time || currentTimeStr,
        category: parsed.category || 'Jajan',
        debtor: parsed.debtor?.trim().toUpperCase() || null,
        creditor: parsed.creditor?.trim().toUpperCase() || null,
        debtAmount: integerDebtAmount,
        notes: parsed.notes || null,
        paymentMethod: detectedMethod,
        source: inputSource
      })
      .returning();

    // Prepare atomic debt adjustment if needed
    let debtStmt = null;
    if (parsed.debtor && integerDebtAmount > 0) {
      debtStmt = await getDebtAdjustmentStatement(db, userId, parsed.debtor, integerDebtAmount, 0);
    } else if (parsed.creditor && integerDebtAmount > 0) {
      debtStmt = await getDebtAdjustmentStatement(
        db,
        userId,
        parsed.creditor,
        0,
        integerDebtAmount
      );
    }

    let insertedRow: schema.Transaction;
    if (debtStmt) {
      const batchResults = (await db.batch([insertTxStmt, debtStmt])) as [
        schema.Transaction[],
        unknown
      ];
      insertedRow = batchResults[0][0];
    } else {
      const rows = await insertTxStmt;
      insertedRow = rows[0];
    }

    console.log(
      `[TRANSACTION_LOGGER] User:${userId} | ID: ${insertedRow.id} | Nama: "${insertedRow.name}" | Rp${insertedRow.amount} | Kategori: ${insertedRow.category} | Sumber: ${inputSource.toUpperCase()}`
    );

    return c.json({
      success: true,
      recorded: true,
      transaction: inserted[0],
      reply:
        parsed.reply ||
        `Berhasil dicatat: ${parsed.name} Rp ${parsed.amount.toLocaleString('id-ID')} (${parsed.category})`
    });
  }
);

function fallbackLocalParser(
  text: string,
  today: string,
  currentTime: string,
  userCategories: Array<{ name: string; emoji: string }> = []
): GeminiParsedResponse {
  const lower = text.toLowerCase();

  // Date detection & backdating
  let targetDate = today;
  if (lower.includes('kemarin')) {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    targetDate = d.toISOString().split('T')[0];
  }

  // Time detection
  let targetTime = currentTime;
  if (lower.includes('pagi')) {
    targetTime = '07:00:00';
  } else if (lower.includes('siang')) {
    targetTime = '12:00:00';
  } else if (lower.includes('sore')) {
    targetTime = '17:00:00';
  } else if (lower.includes('malam')) {
    targetTime = '20:00:00';
  }

  // Extract number (e.g. 15k, 15rb, 15ribu, 15000, 15.000, Rp20.000)
  let amount = 0;
  const numMatch = lower.match(/(?:rp\.?\s*)?(\d+[\d.,]*)\s*(k|rb|ribu)?/);
  if (numMatch) {
    const raw = numMatch[1].replace(/[.,]/g, '');
    let val = parseInt(raw, 10);
    if (numMatch[2] === 'k' || numMatch[2] === 'rb' || numMatch[2] === 'ribu') {
      val *= 1000;
    }
    amount = val;
  }

  // Dynamic category detection
  let category = userCategories[0]?.name || 'Makan';
  const matchedUserCat = userCategories.find((c) => lower.includes(c.name.toLowerCase()));
  if (matchedUserCat) {
    category = matchedUserCat.name;
  } else if (
    lower.includes('bensin') ||
    lower.includes('motor') ||
    lower.includes('servis') ||
    lower.includes('oli') ||
    lower.includes('tambal')
  ) {
    const found = userCategories.find((c) => /transport|motor|kendaraan/i.test(c.name));
    if (found) category = found.name;
  } else if (
    lower.includes('soto') ||
    lower.includes('mie') ||
    lower.includes('nasi') ||
    lower.includes('makan') ||
    lower.includes('ayam') ||
    lower.includes('bakso') ||
    lower.includes('warteg') ||
    lower.includes('bebek')
  ) {
    const found = userCategories.find((c) => /makan/i.test(c.name));
    if (found) category = found.name;
  } else if (
    lower.includes('listrik') ||
    lower.includes('kos') ||
    lower.includes('kost') ||
    lower.includes('galon') ||
    lower.includes('pulsa') ||
    lower.includes('paket') ||
    lower.includes('sabun') ||
    lower.includes('odol')
  ) {
    const found = userCategories.find((c) => /primer|kebutuhan|rutin/i.test(c.name));
    if (found) category = found.name;
  } else if (
    lower.includes('basket') ||
    lower.includes('gym') ||
    lower.includes('renang') ||
    lower.includes('futsal') ||
    lower.includes('badminton')
  ) {
    const found = userCategories.find((c) => /olga|olahraga|sport/i.test(c.name));
    if (found) category = found.name;
  } else if (
    lower.includes('celana') ||
    lower.includes('baju') ||
    lower.includes('parfum') ||
    lower.includes('sepatu') ||
    lower.includes('tas') ||
    lower.includes('kaos')
  ) {
    const found = userCategories.find((c) => /belanja|shopping/i.test(c.name));
    if (found) category = found.name;
  } else {
    const jajanFound = userCategories.find((c) => /jajan|kopi|snack/i.test(c.name));
    if (jajanFound) category = jajanFound.name;
  }

  // Debt detection
  let debtor = '';
  let creditor = '';
  let debtAmount = 0;
  if (lower.includes('nalangi')) {
    const m = lower.match(/nalangi\s+([a-z]+)/);
    if (m) debtor = m[1].toUpperCase();
    debtAmount = amount;
  } else if (lower.includes('ditalangi')) {
    const m = lower.match(/ditalangi\s+([a-z]+)/);
    if (m) creditor = m[1].toUpperCase();
    debtAmount = amount;
  }

  // Clean item name: remove currency, numbers, and conversational stop-words
  let clean = text
    .replace(/(?:rp\.?|rupiah)\s*(\d+[\d.,]*)\s*(k|rb|ribu)?/gi, '')
    .replace(/(\d+[\d.,]*)\s*(k|rb|ribu)?/gi, '')
    .replace(/\b(rp|rupiah)\b/gi, '');

  const stopWordsRegex =
    /\b(hari\s+ini|kemarin|tadi|pagi|siang|sore|malam|saya|aku|gue|gw|gua|ane|beli|membeli|makan|minum|isi|bayar|buat|untuk|sebesar|habis|di|ke|nalangi|ditalangi)\b/gi;
  clean = clean.replace(stopWordsRegex, '').replace(/\s+/g, ' ').trim();
  clean = clean.replace(/^[^\w]+|[^\w]+$/g, '').trim();

  const name = clean
    ? clean.charAt(0).toUpperCase() + clean.slice(1)
    : category !== 'Jajan'
      ? category
      : 'Pengeluaran';

  return {
    action: 'expense',
    name,
    amount: amount || 10000,
    date: targetDate,
    time: targetTime,
    category,
    debtor,
    creditor,
    debt_amount: debtAmount,
    reply: `Tercatat: ${name} sebesar Rp ${(amount || 10000).toLocaleString('id-ID')} (${category})`
  };
}
