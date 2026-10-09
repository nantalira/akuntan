import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../../db/client';
import type { AppEnv } from '../index';
import { getAiQuotaStatus, incrementAiUsage, resolveUserGeminiConfig } from '../utils/aiUsage';
import { getUserActiveCategories } from '../utils/categories';

export type ReceiptExtractedData = {
  merchant: string;
  amount: number;
  category: string;
  date: string;
  time: string;
  items: string[];
  notes: string;
  confidence: 'high' | 'medium' | 'low';
};

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

    const { apiKey, isCustomKey } = await resolveUserGeminiConfig(db, userId, c.env.GEMINI_API_KEY);

    if (!apiKey) {
      return c.json(
        {
          success: false,
          error: 'GEMINI_API_KEY belum dikonfigurasi di server maupun di Pengaturan Profil Anda'
        },
        500
      );
    }

    const quota = await getAiQuotaStatus(db, userId, modelName, c.env.AI_DAILY_LIMIT, isCustomKey);
    if (quota.remaining <= 0) {
      return c.json(
        {
          success: false,
          error:
            'Kuota harian AI telah habis. Silakan catat manual atau masukkan Gemini API Key pribadi di Pengaturan Profil.'
        },
        429
      );
    }

    const { imageBase64, mimeType = 'image/jpeg' } = c.req.valid('json');

    // Clean data URL prefix if present (e.g. data:image/png;base64,xxxx)
    const cleanBase64 = imageBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '').trim();

    // Current WIB (UTC+7) reference
    const now = new Date();
    const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
    const wibDate = new Date(utcTime + 7 * 3600000);
    const todayStr = wibDate.toISOString().split('T')[0];
    const currentTimeStr = wibDate.toTimeString().split(' ')[0];

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

      const parsed = JSON.parse(textContent) as ReceiptExtractedData;
      try {
        await incrementAiUsage(db, userId, modelName);
      } catch (dbErr) {
        console.error('Failed to increment AI usage counter in scanReceipt:', dbErr);
      }

      // Normalize category with user's active categories
      let safeCategory = userCats[0]?.name || 'Belanja';
      if (parsed.category) {
        const match = userCats.find((c) => c.name.toLowerCase() === parsed.category?.toLowerCase());
        if (match) {
          safeCategory = match.name;
        }
      }

      const normalizedData: ReceiptExtractedData = {
        merchant: parsed.merchant || 'Struk Belanja',
        amount: Math.round(Number(parsed.amount) || 0),
        category: safeCategory,
        date: parsed.date || todayStr,
        time: parsed.time || currentTimeStr,
        items: Array.isArray(parsed.items) ? parsed.items : [],
        notes: parsed.notes || (Array.isArray(parsed.items) ? parsed.items.join(', ') : ''),
        confidence: parsed.confidence || 'medium'
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
