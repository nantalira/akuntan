import type { getDb } from '../../db/client';
import type { Bindings } from '../index';
import { getAiQuotaStatus, incrementAiUsage, resolveUserGeminiConfig } from './aiUsage';

export type PaymentMethodType =
  | 'Cash'
  | 'QRIS'
  | 'BCA'
  | 'Mandiri'
  | 'BRI'
  | 'BNI'
  | 'GoPay'
  | 'OVO'
  | 'DANA'
  | 'ShopeePay'
  | 'Transfer';

export function detectPaymentMethod(
  text: string,
  defaultMethod: PaymentMethodType = 'Cash'
): PaymentMethodType {
  const lower = text.toLowerCase();
  if (lower.includes('gopay')) return 'GoPay';
  if (lower.includes('shopeepay') || lower.includes('spay')) return 'ShopeePay';
  if (lower.includes('dana')) return 'DANA';
  if (lower.includes('ovo')) return 'OVO';
  if (lower.includes('mybca') || lower.includes('bca')) return 'BCA';
  if (lower.includes('livin') || lower.includes('mandiri')) return 'Mandiri';
  if (lower.includes('brimo') || lower.includes('bri')) return 'BRI';
  if (lower.includes('wondr') || lower.includes('bni')) return 'BNI';
  if (lower.includes('qris')) return 'QRIS';
  if (lower.includes('transfer') || lower.includes('tf')) return 'Transfer';
  if (lower.includes('tunai') || lower.includes('cash')) return 'Cash';
  return defaultMethod;
}

export function detectCategoryFromMerchant(
  merchantName: string
): 'Makan' | 'Jajan' | 'Primer' | 'Motor' | 'Olga' | 'Belanja' {
  const lower = merchantName.toLowerCase();
  if (
    lower.includes('pertamina') ||
    lower.includes('shell') ||
    lower.includes('spbu') ||
    lower.includes('bengkel') ||
    lower.includes('motor') ||
    lower.includes('parkir')
  ) {
    return 'Motor';
  }
  if (
    lower.includes('indomaret') ||
    lower.includes('alfamart') ||
    lower.includes('alfamidi') ||
    lower.includes('superindo') ||
    lower.includes('apotek') ||
    lower.includes('kimia farma') ||
    lower.includes('k24') ||
    lower.includes('pln') ||
    lower.includes('pdam') ||
    lower.includes('telkomsel')
  ) {
    return 'Primer';
  }
  if (
    lower.includes('kopi') ||
    lower.includes('coffee') ||
    lower.includes('kenangan') ||
    lower.includes('fore') ||
    lower.includes('janji jiwa') ||
    lower.includes('mixue') ||
    lower.includes('chatime') ||
    lower.includes('bakery') ||
    lower.includes('roti') ||
    lower.includes('martabak') ||
    lower.includes('cafe')
  ) {
    return 'Jajan';
  }
  if (
    lower.includes('warung') ||
    lower.includes('rm ') ||
    lower.includes('rumah makan') ||
    lower.includes('soto') ||
    lower.includes('bakso') ||
    lower.includes('mie') ||
    lower.includes('nasi') ||
    lower.includes('ayam') ||
    lower.includes('bebek') ||
    lower.includes('padang') ||
    lower.includes('sate') ||
    lower.includes('resto') ||
    lower.includes('kfc') ||
    lower.includes('mcd') ||
    lower.includes('hokben') ||
    lower.includes('solaria') ||
    lower.includes('gacoan')
  ) {
    return 'Makan';
  }
  if (
    lower.includes('gym') ||
    lower.includes('sport') ||
    lower.includes('futsal') ||
    lower.includes('badminton') ||
    lower.includes('decathlon')
  ) {
    return 'Olga';
  }
  if (
    lower.includes('uniqlo') ||
    lower.includes('shopee') ||
    lower.includes('tokopedia') ||
    lower.includes('miniso') ||
    lower.includes('ace hardware') ||
    lower.includes('mr diy') ||
    lower.includes('gramedia')
  ) {
    return 'Belanja';
  }
  return 'Jajan';
}

export interface ParsedQrisTransaction {
  merchant: string;
  amount: number;
  category: 'Makan' | 'Jajan' | 'Primer' | 'Motor' | 'Olga' | 'Belanja';
  paymentMethod: PaymentMethodType;
  referenceId: string | null;
  notes: string;
  parsedBy: 'regex' | 'ai';
}

/**
 * Engine 1: Regex Bank Indonesia Parser (0 AI Quota)
 * Recognizes BCA, myBCA, Livin Mandiri, BRImo, BNI Wondr, GoPay, DANA, OVO, ShopeePay notifications & emails
 */
export function parseBankNotificationRegex(
  rawText: string,
  title?: string,
  appPackage?: string
): ParsedQrisTransaction | null {
  const combined = `${title || ''} ${rawText}`.replace(/\s+/g, ' ').trim();

  // 1. Extract Nominal Rupiah (e.g. Rp 28.500,00 | Rp28.500 | IDR 45,000.00 | Rp 15000)
  const amountMatch = combined.match(
    /(?:Rp\.?|IDR)\s*([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]{4,})(?:[.,][0-9]{2})?/i
  );
  if (!amountMatch) {
    return null;
  }

  const cleanDigits = amountMatch[1].replace(/[.,]/g, '');
  const amount = Number.parseInt(cleanDigits, 10);
  if (!amount || Number.isNaN(amount) || amount <= 0) {
    return null;
  }

  // 2. Extract Reference ID if present
  const refMatch = combined.match(
    /(?:Ref(?:erensi)?|No\.?\s*Ref|ID\s*Transaksi)[:\s#]*([A-Z0-9-]{6,})/i
  );
  const referenceId = refMatch ? refMatch[1] : null;

  // 3. Extract Merchant Name after standard Indonesian banking prepositions
  let merchant = '';
  const merchantPatterns = [
    /(?:ke|kepada|di|merchant|penerima|toko)\s*[:=-]?\s*([A-Z0-9][A-Za-z0-9\s.,'&()-]{2,35}?)(?=\s+(?:berhasil|sukses|pada|senilai|sebesar|dengan|tanggal|tgl|via|no\.|ref|$))/i,
    /(?:ke|kepada|di)\s+([A-Za-z0-9\s.'&-]{3,30})/i
  ];

  for (const regex of merchantPatterns) {
    const m = combined.match(regex);
    if (m?.[1]) {
      merchant = m[1].replace(/\b(berhasil|sukses|pada|tanggal|via|qris)\b/gi, '').trim();
      if (merchant.length >= 2) break;
    }
  }

  if (!merchant) {
    return null;
  }

  const paymentMethod = detectPaymentMethod(`${appPackage || ''} ${combined}`, 'QRIS');
  const category = detectCategoryFromMerchant(merchant);

  return {
    merchant,
    amount,
    category,
    paymentMethod,
    referenceId,
    notes: `Otomatis via Webhook QRIS (${paymentMethod})`,
    parsedBy: 'regex'
  };
}

/**
 * Smart Dual-Engine Parser:
 * Tries Engine 1 (Fast Indonesian Bank Regex) first.
 * Falls back to Engine 2 (Gemini AI) if regex cannot confidently extract merchant & amount.
 */
export async function parseQrisNotificationSmart(
  rawText: string,
  title: string | undefined,
  appPackage: string | undefined,
  db: ReturnType<typeof getDb>,
  userId: number,
  env: Bindings
): Promise<ParsedQrisTransaction | null> {
  // Try Engine 1 (Regex - 0 AI Quota)
  const regexResult = parseBankNotificationRegex(rawText, title, appPackage);
  if (regexResult && regexResult.amount > 0 && regexResult.merchant.length >= 2) {
    return regexResult;
  }

  // Engine 2: Fallback to Gemini AI
  const { apiKey, isCustomKey } = await resolveUserGeminiConfig(db, userId, env.GEMINI_API_KEY);
  const modelName = env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

  if (!apiKey) {
    return regexResult;
  }

  const quota = await getAiQuotaStatus(db, userId, modelName, env.AI_DAILY_LIMIT, isCustomKey);
  if (quota.remaining <= 0) {
    return regexResult;
  }

  try {
    const prompt = `Ekstrak informasi transaksi pembayaran QRIS/Transfer Bank dari teks notifikasi atau email berikut:
Judul: "${title || ''}"
Aplikasi: "${appPackage || ''}"
Isi Teks: "${rawText}"

Kembalikan JSON dengan struktur:
{
  "merchant": "Nama Toko / Merchant (contoh: Warung Soto Pak Budi)",
  "amount": 25000,
  "category": "Makan" | "Jajan" | "Primer" | "Motor" | "Olga" | "Belanja",
  "paymentMethod": "QRIS" | "BCA" | "Mandiri" | "BRI" | "BNI" | "GoPay" | "OVO" | "DANA" | "ShopeePay",
  "referenceId": "nomor referensi jika ada atau null"
}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1
          }
        })
      }
    );

    if (!res.ok) return regexResult;

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textContent) return regexResult;

    const parsed = JSON.parse(textContent) as {
      merchant?: string;
      amount?: number;
      category?: 'Makan' | 'Jajan' | 'Primer' | 'Motor' | 'Olga' | 'Belanja';
      paymentMethod?: PaymentMethodType;
      referenceId?: string | null;
    };

    if (!parsed.amount || parsed.amount <= 0) return regexResult;

    await incrementAiUsage(db, userId, modelName);

    return {
      merchant: parsed.merchant || 'Pembayaran QRIS',
      amount: Math.round(parsed.amount),
      category: parsed.category || 'Jajan',
      paymentMethod: parsed.paymentMethod || 'QRIS',
      referenceId: parsed.referenceId || null,
      notes: `Otomatis via Webhook QRIS AI (${parsed.paymentMethod || 'QRIS'})`,
      parsedBy: 'ai'
    };
  } catch {
    return regexResult;
  }
}
