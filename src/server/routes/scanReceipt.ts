import { Buffer } from 'node:buffer';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../../db/client';
import type { AppEnv } from '../index';
import { consumeAiQuotaAtomic, resolveUserGeminiConfig } from '../utils/aiQuota';
import { getUserActiveCategories } from '../utils/categories';
import { toMonetaryInteger } from '../utils/paymentParser';

export type ReceiptExtractedData = {
  merchant: string;
  amount: number;
  category: string;
  date: string;
  time: string;
  items: string[];
  notes: string;
  confidence: 'high' | 'medium' | 'low';
  storageKey?: string;
};

const receiptExtractionZodSchema = z.object({
  merchant: z.string().default('Toko/Kasir'),
  amount: z.union([z.number(), z.string()]).transform((val) => toMonetaryInteger(val)),
  category: z.string().default('Belanja'),
  date: z.string().optional(),
  time: z.string().optional(),
  items: z.array(z.string()).default([]),
  notes: z.string().default(''),
  confidence: z.enum(['high', 'medium', 'low']).default('medium')
});

const scanReceiptSchema = z.object({
  imageBase64: z.string().min(1, 'Gambar struk tidak boleh kosong'),
  mimeType: z.string().optional()
});

export const scanReceiptRoute = new Hono<AppEnv>().post(
  '/',
  zValidator('json', scanReceiptSchema),
  async (c) => {
    const db = getDb(c.env.DB);
    const userId = c.get('userId');
    const modelName = c.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

    const { apiKey } = await resolveUserGeminiConfig(db, userId, c.env.GEMINI_API_KEY);

    if (!apiKey) {
      return c.json(
        {
          success: false,
          error: 'GEMINI_API_KEY belum dikonfigurasi di server maupun di Pengaturan Profil Anda'
        },
        500
      );
    }

    // 1. Enforce atomic quota check & deduction before calling external Vision API
    const quotaResult = await consumeAiQuotaAtomic(db, userId, {
      modelName,
      overrideLimit: c.env.AI_DAILY_LIMIT,
      serverApiKey: c.env.GEMINI_API_KEY
    });

    if (!quotaResult.allowed) {
      return c.json(
        {
          success: false,
          error:
            quotaResult.message ||
            'Kuota harian AI telah habis. Silakan catat manual atau masukkan Gemini API Key pribadi di Pengaturan Profil.'
        },
        429
      );
    }

    const { imageBase64, mimeType = 'image/jpeg' } = c.req.valid('json');

    // Clean data URL prefix if present (e.g. data:image/png;base64,xxxx)
    const cleanBase64 = imageBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '').trim();

    // Invariant: Reject image payloads exceeding 4MB (HTTP 413)
    const approxByteLength = Math.ceil((cleanBase64.length * 3) / 4);
    if (approxByteLength > 4 * 1024 * 1024) {
      return c.json(
        {
          success: false,
          error: 'Ukuran berkas gambar melebihi batas maksimal 4MB'
        },
        413
      );
    }

    // Current WIB (UTC+7) reference
    const now = new Date();
    const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
    const wibDate = new Date(utcTime + 7 * 3600000);
    const todayStr = wibDate.toISOString().split('T')[0];
    const currentTimeStr = wibDate.toTimeString().split(' ')[0];

    // 2. Direct Cloudflare R2 stream upload (Zero-cost binding, no AWS SDK)
    let receiptStorageKey: string | undefined;
    if (c.env.RECEIPTS_BUCKET) {
      try {
        const binaryData = Buffer.from(cleanBase64, 'base64');
        const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
        const storageKey = `receipts/${userId}/${todayStr}/${crypto.randomUUID()}.${ext}`;
        await c.env.RECEIPTS_BUCKET.put(storageKey, binaryData, {
          httpMetadata: { contentType: mimeType },
          customMetadata: {
            userId: String(userId),
            uploadedAt: new Date().toISOString()
          }
        });
        receiptStorageKey = storageKey;
      } catch (r2Err) {
        console.error('[R2 Storage] Failed to store receipt in R2:', r2Err);
      }
    }

    const userCats = await getUserActiveCategories(db, userId);
    const catNames = userCats.map((c) => c.name);
    const catNamesFormatted = catNames.map((n) => `"${n}"`).join(', ');
    const catListPrompt = userCats.map((c) => `   - "${c.name}" (${c.emoji})`).join('\n');

    const systemPrompt = `Kamu adalah OCR akuntan struk kasir berbahasa Indonesia yang sangat teliti.
Tugasmu adalah menganalisis foto struk belanjaan kasir (minimarket, supermarket, restoran, kafe, SPBU, apotek, toko baju, perkakas, dll).
Hari ini adalah: ${todayStr}, jam saat ini: ${currentTimeStr} (WIB).

Instruksi Analisis:
1. "merchant": Nama toko / restoran / kasir (contoh: "Indomaret", "Alfamart", "Kopi Kenangan", "SPBU Pertamina"). Jika tidak terbaca jelas, isi "Toko/Kasir".
2. "amount": Nominal total akhir yang dibayar (Grand Total setelah diskon/pajak). WAJIB bilangan bulat positif (integer). Jangan ambil subtotal sebelum diskon jika ada Grand Total.
3. "category": Tentukan satu kategori yang paling tepat dari pos pengeluaran pengguna berikut:
${catListPrompt}
   WAJIB persis salah satu dari: [${catNamesFormatted}].
4. "date": Tanggal transaksi berformat "YYYY-MM-DD" jika tertera di struk. Jika tanggal di struk tidak terbaca atau buram, gunakan tanggal hari ini: "${todayStr}".
5. "time": Waktu transaksi berformat "HH:mm:ss" jika tertera di struk, atau jam saat ini: "${currentTimeStr}".
6. "items": Daftar array string ringkasan nama item barang yang dibeli (maksimal 5 item utama).
7. "notes": Rangkuman singkat belanjaan untuk catatan transaksi (misal: "Belanja mingguan sabun & minyak").
8. "confidence": "high" jika angka total dan merchant sangat jelas, "medium" jika sebagian agak buram, "low" jika sangat sulit dibaca.

Kembalikan respon DALAM FORMAT JSON PERSIS SEPERTI INI:
{
  "merchant": "Indomaret",
  "amount": 47500,
  "category": ${catNames[0] ? `"${catNames[0]}"` : '"Belanja"'},
  "date": "${todayStr}",
  "time": "${currentTimeStr}",
  "items": ["Minyak Goreng 2L", "Sabun Cuci", "Pasta Gigi"],
  "notes": "Minyak Goreng 2L, Sabun Cuci, Pasta Gigi",
  "confidence": "high"
}`;

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
                  { text: systemPrompt },
                  {
                    inlineData: {
                      mimeType: mimeType,
                      data: cleanBase64
                    }
                  }
                ]
              }
            ],
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

      type GeminiVisionResponse = {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
        error?: {
          message?: string;
          code?: number;
        };
      };

      const data = (await res.json()) as GeminiVisionResponse;

      if (data.error) {
        throw new Error(`Gemini API Error: ${data.error.message || JSON.stringify(data.error)}`);
      }

      const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textContent) {
        throw new Error('Gemini tidak mengembalikan teks ekstraksi');
      }

      const rawParsed = JSON.parse(textContent);
      const parsed = receiptExtractionZodSchema.parse(rawParsed);

      // Normalize category with user's active categories
      let safeCategory = userCats[0]?.name || 'Belanja';
      if (parsed.category) {
        const match = userCats.find((c) => c.name.toLowerCase() === parsed.category?.toLowerCase());
        if (match) {
          safeCategory = match.name;
        }
      }

      const normalizedData: ReceiptExtractedData = {
        merchant: parsed.merchant,
        amount: parsed.amount, // Enforced integer Rupiah via toMonetaryInteger
        category: safeCategory,
        date: parsed.date || todayStr,
        time: parsed.time || currentTimeStr,
        items: parsed.items,
        notes: parsed.notes || (parsed.items.length > 0 ? parsed.items.join(', ') : ''),
        confidence: parsed.confidence,
        storageKey: receiptStorageKey
      };

      return c.json({
        success: true,
        data: normalizedData
      });
    } catch (err) {
      console.error('Scan receipt error:', err);
      return c.json(
        {
          success: false,
          error: err instanceof Error ? err.message : 'Gagal memproses gambar struk kasir'
        },
        500
      );
    }
  }
);
