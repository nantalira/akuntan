import { Hono } from 'hono';
import { getDb } from '../../db/client';
import type { Bindings } from '../index';
import { getAiQuotaStatus, incrementAiUsage } from '../utils/aiUsage';

export type ReceiptExtractedData = {
  merchant: string;
  amount: number;
  category: 'Makan' | 'Jajan' | 'Primer' | 'Motor' | 'Olga' | 'Belanja';
  date: string;
  time: string;
  items: string[];
  notes: string;
  confidence: 'high' | 'medium' | 'low';
};

export const scanReceiptRoute = new Hono<{ Bindings: Bindings }>().post('/', async (c) => {
  const apiKey = c.env.GEMINI_API_KEY;
  const modelName = c.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

  if (!apiKey) {
    return c.json({ success: false, error: 'GEMINI_API_KEY belum dikonfigurasi' }, 500);
  }

  const db = getDb(c.env.DB);
  const quota = await getAiQuotaStatus(db, modelName, c.env.AI_DAILY_LIMIT);
  if (quota.remaining <= 0) {
    return c.json(
      {
        success: false,
        error: 'Kuota harian AI telah habis. Silakan catat transaksi secara manual.'
      },
      429
    );
  }

  const { imageBase64, mimeType = 'image/jpeg' } = await c.req.json<{
    imageBase64: string;
    mimeType?: string;
  }>();

  if (!imageBase64) {
    return c.json({ success: false, error: 'Gambar struk tidak boleh kosong' }, 400);
  }

  // Clean data URL prefix if present (e.g. data:image/png;base64,xxxx)
  const cleanBase64 = imageBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '').trim();

  // Current WIB (UTC+7) reference
  const now = new Date();
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
  const wibDate = new Date(utcTime + 7 * 3600000);
  const todayStr = wibDate.toISOString().split('T')[0];
  const currentTimeStr = wibDate.toTimeString().split(' ')[0];

  const systemPrompt = `Kamu adalah OCR akuntan struk kasir berbahasa Indonesia yang sangat teliti.
Tugasmu adalah menganalisis foto struk belanjaan kasir (minimarket, supermarket, restoran, kafe, SPBU, apotek, toko baju, perkakas, dll).
Hari ini adalah: ${todayStr}, jam saat ini: ${currentTimeStr} (WIB).

Instruksi Analisis:
1. "merchant": Nama toko / restoran / kasir (contoh: "Indomaret", "Alfamart", "Kopi Kenangan", "SPBU Pertamina"). Jika tidak terbaca jelas, isi "Toko/Kasir".
2. "amount": Nominal total akhir yang dibayar (Grand Total setelah diskon/pajak). WAJIB bilangan bulat positif (integer). Jangan ambil subtotal sebelum diskon jika ada Grand Total.
3. "category": Tentukan satu kategori yang paling tepat dari 6 kategori wajib berikut:
   - "Makan": Makanan berat / resto (nasi, ayam, steak, bakso, warteg, mie).
   - "Jajan": Minuman kopi, boba, es krim, snack, camilan, rokok.
   - "Primer": Kebutuhan pokok harian (minyak, beras, sabun, odol, deterjen, galon, obat apotek).
   - "Motor": Bensin SPBU, servis, oli, tambal ban.
   - "Olga": Tiket gym, sewa lapangan, perlengkapan olahraga.
   - "Belanja": Pakaian, perabotan, elektronik, buku, perkakas non-makanan.
4. "date": Tanggal transaksi berformat "YYYY-MM-DD" jika tertera di struk. Jika tanggal di struk tidak terbaca atau buram, gunakan tanggal hari ini: "${todayStr}".
5. "time": Waktu transaksi berformat "HH:mm:ss" jika tertera di struk, atau jam saat ini: "${currentTimeStr}".
6. "items": Daftar array string ringkasan nama item barang yang dibeli (maksimal 5 item utama).
7. "notes": Rangkuman singkat belanjaan untuk catatan transaksi (misal: "Belanja mingguan sabun & minyak").
8. "confidence": "high" jika angka total dan merchant sangat jelas, "medium" jika sebagian agak buram, "low" jika sangat sulit dibaca.

Kembalikan respon DALAM FORMAT JSON PERSIS SEPERTI INI:
{
  "merchant": "Indomaret",
  "amount": 47500,
  "category": "Primer",
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
      await incrementAiUsage(db, modelName);
    } catch (dbErr) {
      console.error('Failed to increment AI usage counter in scanReceipt:', dbErr);
    }

    // Normalize category
    const validCategories = ['Makan', 'Jajan', 'Primer', 'Motor', 'Olga', 'Belanja'] as const;
    let safeCategory: (typeof validCategories)[number] = 'Belanja';
    if (validCategories.includes(parsed.category as (typeof validCategories)[number])) {
      safeCategory = parsed.category as (typeof validCategories)[number];
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
});
