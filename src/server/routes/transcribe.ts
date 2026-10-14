import { Buffer } from 'node:buffer';
import { Hono } from 'hono';
import { getDb } from '../../db/client';
import type { AppEnv } from '../index';
import { consumeAiQuotaAtomic, getTodayDateString } from '../utils/aiQuota';

export const transcribeRoute = new Hono<AppEnv>().post('/', async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');

  // 1. Enforce atomic AI quota check & increment before invoking model
  const quotaResult = await consumeAiQuotaAtomic(db, userId, {
    modelName: 'whisper',
    overrideLimit: c.env.AI_DAILY_LIMIT,
    serverApiKey: c.env.GEMINI_API_KEY
  });

  if (!quotaResult.allowed) {
    return c.json(
      {
        success: false,
        fallback: true,
        error:
          quotaResult.message ||
          'Kuota harian AI telah habis. Silakan gunakan formulir input manual.'
      },
      429
    );
  }

  // 2. Reject audio payloads exceeding 10MB (HTTP 413 Gatekeeper)
  const contentLength = Number(c.req.header('content-length') || 0);
  if (contentLength > 10 * 1024 * 1024) {
    return c.json(
      {
        success: false,
        fallback: true,
        error: 'Ukuran berkas audio melebihi batas maksimal 10MB'
      },
      413
    );
  }

  // 3. Extract audio data from various possible client request payloads
  let audioBuffer: ArrayBuffer | null = null;
  let mimeType = 'audio/webm';
  const contentType = c.req.header('content-type') || '';

  try {
    if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.formData();
      const file = (formData.get('file') || formData.get('audio')) as unknown as File | null;
      if (file && typeof file.arrayBuffer === 'function') {
        audioBuffer = await file.arrayBuffer();
        if (file.type) mimeType = file.type;
      }
    } else if (contentType.includes('application/json')) {
      const body = await c.req.json<{
        audioBase64?: string;
        audio?: string;
        mimeType?: string;
      }>();
      const rawB64 = body.audioBase64 || body.audio;
      if (rawB64) {
        const cleanB64 = rawB64.replace(/^data:audio\/[a-zA-Z0-9/+-]+;base64,/, '').trim();
        const nodeBuf = Buffer.from(cleanB64, 'base64');
        audioBuffer = nodeBuf.buffer.slice(
          nodeBuf.byteOffset,
          nodeBuf.byteOffset + nodeBuf.byteLength
        );
      }
      if (body.mimeType) mimeType = body.mimeType;
    } else if (contentType.startsWith('audio/')) {
      audioBuffer = await c.req.arrayBuffer();
      mimeType = contentType.split(';')[0].trim();
    }
  } catch (err) {
    console.error('[Transcribe] Error parsing audio request body:', err);
    return c.json(
      {
        success: false,
        fallback: true,
        error: 'Format data audio tidak valid'
      },
      400
    );
  }

  if (!audioBuffer || audioBuffer.byteLength === 0) {
    return c.json(
      {
        success: false,
        fallback: true,
        error: 'Berkas audio tidak ditemukan atau kosong'
      },
      400
    );
  }

  // 3. Optional Direct Cloudflare R2 audio retention (Zero-Cost direct binding)
  let audioStorageKey: string | undefined;
  if (c.env.RECEIPTS_BUCKET) {
    try {
      const todayStr = getTodayDateString();
      const ext = mimeType.includes('wav')
        ? 'wav'
        : mimeType.includes('mp4') || mimeType.includes('m4a')
          ? 'm4a'
          : mimeType.includes('ogg')
            ? 'ogg'
            : 'webm';
      const storageKey = `audio/${userId}/${todayStr}/${crypto.randomUUID()}.${ext}`;
      await c.env.RECEIPTS_BUCKET.put(storageKey, audioBuffer, {
        httpMetadata: { contentType: mimeType },
        customMetadata: {
          userId: String(userId),
          uploadedAt: new Date().toISOString()
        }
      });
      audioStorageKey = storageKey;
    } catch (r2Err) {
      console.error('[R2 Storage] Failed to store audio in R2:', r2Err);
    }
  }

  // 4. Invoke Cloudflare Workers AI Whisper (@cf/openai/whisper)
  if (!c.env.AI) {
    return c.json(
      {
        success: false,
        fallback: true,
        error: 'Workers AI binding tidak aktif di server ini. Silakan input transaksi manual.'
      },
      503
    );
  }

  try {
    const uint8Audio = new Uint8Array(audioBuffer);
    const aiResponse = (await c.env.AI.run('@cf/openai/whisper', {
      audio: Array.from(uint8Audio)
    })) as { text?: string };

    const transcribedText = aiResponse?.text?.trim() || '';

    if (!transcribedText) {
      return c.json({
        success: false,
        fallback: true,
        error: 'Suara tidak terdengar jelas. Silakan ulangi rekaman atau gunakan pencatatan manual.'
      });
    }

    return c.json({
      success: true,
      text: transcribedText,
      storageKey: audioStorageKey
    });
  } catch (aiErr) {
    console.error('[Workers AI] Whisper transcription error:', aiErr);
    return c.json(
      {
        success: false,
        fallback: true,
        error: aiErr instanceof Error ? aiErr.message : 'Gagal mentranskripsikan rekaman suara'
      },
      500
    );
  }
});
