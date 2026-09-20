import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { getDb, schema } from '../../db/client';
import type { Bindings } from '../index';

interface GeminiParsedResponse {
  action: 'expense' | 'settlement' | 'split_bill' | 'general';
  name?: string;
  amount?: number;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm:ss
  category?: 'Makan' | 'Jajan' | 'Primer' | 'Motor' | 'Olga' | 'Belanja';
  debtor?: string;
  creditor?: string;
  debt_amount?: number;
  notes?: string;
  reply: string;
}

export const chatRoute = new Hono<{ Bindings: Bindings }>().post('/', async (c) => {
  const db = getDb(c.env.DB);
  const { message } = await c.req.json<{ message: string }>();

  if (!message?.trim()) {
    return c.json({ success: false, error: 'Pesan tidak boleh kosong' }, 400);
  }

  // Current WIB (UTC+7) time reference
  const now = new Date();
  // Offset for UTC+7
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
  const wibDate = new Date(utcTime + 7 * 3600000);

  const todayStr = wibDate.toISOString().split('T')[0]; // YYYY-MM-DD
  const currentTimeStr = wibDate.toTimeString().split(' ')[0]; // HH:mm:ss

  const apiKey = c.env.GEMINI_API_KEY;
  const modelName = c.env.GEMINI_MODEL || 'gemini-2.0-flash';
  let parsed: GeminiParsedResponse;

  if (apiKey) {
    try {
      const systemInstruction = `Kamu adalah Akuntan AI, asisten pencatatan pengeluaran pribadi berbahasa Indonesia yang cerdas dan teliti.
Hari ini adalah: ${todayStr}, jam saat ini: ${currentTimeStr} (WIB).

Tugasmu adalah menganalisis pesan santai pengguna tentang pengeluaran, hutang, patungan, atau pelunasan, lalu mengembalikan JSON terstruktur.
Kategori WAJIB salah satu dari: ["Makan", "Jajan", "Primer", "Motor", "Olga", "Belanja"].
- Makan: Makanan berat (nasi padang, dada ayam, rames, soto, telur, lauk).
- Jajan: Camilan, kopi, rokok, gorengan, es, jus, degan.
- Primer: Kebutuhan mutlak (listrik, galon, kos, pulsa, paket internet, sabun, sampo).
- Motor: Transportasi bensin, servis, tambal ban.
- Olga: Olahraga (basket, gym, renang).
- Belanja: Barang fisik awet non-konsumsi (celana, baju, parfum, elektronik, perkakas).

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
  "category": "Makan" | "Jajan" | "Primer" | "Motor" | "Olga" | "Belanja",
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
      } else {
        throw new Error('Empty Gemini response content');
      }
    } catch (err) {
      console.error('Gemini API error, falling back to local heuristic:', err);
      parsed = fallbackLocalParser(message, todayStr, currentTimeStr);
    }
  } else {
    parsed = fallbackLocalParser(message, todayStr, currentTimeStr);
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
      .where(eq(schema.debts.contactName, contact))
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

  // Insert transaction
  const inserted = await db
    .insert(schema.transactions)
    .values({
      name: parsed.name,
      amount: Math.round(parsed.amount),
      date: parsed.date || todayStr,
      time: parsed.time || currentTimeStr,
      category: parsed.category || 'Jajan',
      debtor: parsed.debtor?.trim().toUpperCase() || null,
      creditor: parsed.creditor?.trim().toUpperCase() || null,
      debtAmount: parsed.debt_amount ? Math.round(parsed.debt_amount) : 0,
      notes: parsed.notes || null
    })
    .returning();

  // Update debts
  if (parsed.debtor && parsed.debt_amount) {
    const contact = parsed.debtor.trim().toUpperCase();
    const existing = await db
      .select()
      .from(schema.debts)
      .where(eq(schema.debts.contactName, contact))
      .get();
    if (existing) {
      await db
        .update(schema.debts)
        .set({
          totalOwedToUs: existing.totalOwedToUs + parsed.debt_amount,
          updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(eq(schema.debts.id, existing.id));
    } else {
      await db.insert(schema.debts).values({
        contactName: contact,
        totalOwedToUs: parsed.debt_amount,
        totalWeOwe: 0
      });
    }
  } else if (parsed.creditor && parsed.debt_amount) {
    const contact = parsed.creditor.trim().toUpperCase();
    const existing = await db
      .select()
      .from(schema.debts)
      .where(eq(schema.debts.contactName, contact))
      .get();
    if (existing) {
      await db
        .update(schema.debts)
        .set({
          totalWeOwe: existing.totalWeOwe + parsed.debt_amount,
          updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(eq(schema.debts.id, existing.id));
    } else {
      await db.insert(schema.debts).values({
        contactName: contact,
        totalOwedToUs: 0,
        totalWeOwe: parsed.debt_amount
      });
    }
  }

  return c.json({
    success: true,
    recorded: true,
    transaction: inserted[0],
    reply:
      parsed.reply ||
      `Berhasil dicatat: ${parsed.name} Rp ${parsed.amount.toLocaleString('id-ID')} (${parsed.category})`
  });
});

function fallbackLocalParser(
  text: string,
  today: string,
  currentTime: string
): GeminiParsedResponse {
  const lower = text.toLowerCase();

  // Extract number (e.g. 15k, 15rb, 15000, 15.000)
  let amount = 0;
  const numMatch = lower.match(/(\d+[\d.,]*)\s*(k|rb|ribu)?/);
  if (numMatch) {
    const raw = numMatch[1].replace(/[.,]/g, '');
    let val = parseInt(raw, 10);
    if (numMatch[2] === 'k' || numMatch[2] === 'rb' || numMatch[2] === 'ribu') {
      val *= 1000;
    }
    amount = val;
  }

  // Category detection
  let category: GeminiParsedResponse['category'] = 'Jajan';
  if (lower.includes('bensin') || lower.includes('motor') || lower.includes('servis'))
    category = 'Motor';
  else if (
    lower.includes('soto') ||
    lower.includes('mie') ||
    lower.includes('nasi') ||
    lower.includes('makan') ||
    lower.includes('ayam')
  )
    category = 'Makan';
  else if (
    lower.includes('listrik') ||
    lower.includes('kos') ||
    lower.includes('galon') ||
    lower.includes('pulsa') ||
    lower.includes('paket')
  )
    category = 'Primer';
  else if (lower.includes('basket') || lower.includes('gym') || lower.includes('renang'))
    category = 'Olga';
  else if (
    lower.includes('celana') ||
    lower.includes('baju') ||
    lower.includes('parfum') ||
    lower.includes('sepatu')
  )
    category = 'Belanja';

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

  // Clean item name
  const name =
    text
      .replace(/(\d+[\d.,]*)\s*(k|rb|ribu)?/gi, '')
      .replace(/(tadi|kemarin|malam|pagi|siang|beli|makan|isi|nalangi|ditalangi)\s*/gi, '')
      .trim() || 'Pengeluaran';

  return {
    action: 'expense',
    name: name.charAt(0).toUpperCase() + name.slice(1),
    amount: amount || 10000,
    date: today,
    time: currentTime,
    category,
    debtor,
    creditor,
    debt_amount: debtAmount,
    reply: `Tercatat: ${name} sebesar Rp ${(amount || 10000).toLocaleString('id-ID')} (${category})`
  };
}
