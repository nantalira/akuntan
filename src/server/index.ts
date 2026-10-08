import { Buffer } from 'node:buffer';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware } from './middleware/auth';
import { aiQuotaRoute } from './routes/aiQuota';
import { analyticsRoute } from './routes/analytics';
import { authRoute } from './routes/auth';
import { budgetsRoute } from './routes/budgets';
import { chatRoute } from './routes/chat';
import { debtsRoute } from './routes/debts';
import { exportRoute } from './routes/export';
import { scanReceiptRoute } from './routes/scanReceipt';
import { transactionsRoute } from './routes/transactions';
import { webhooksRoute } from './routes/webhooks';

export type Bindings = {
  DB: D1Database;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  APP_PASSCODE?: string;
  AI_DAILY_LIMIT?: string;
  JWT_SECRET?: string;
  ASSETS?: Fetcher;
};

export type Variables = {
  userId: number;
  userEmail: string;
  userName: string;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};

const app = new Hono<AppEnv>();

app.use(
  '/api/*',
  cors({
    origin: (origin) => origin || '*',
    credentials: true
  })
);

// Public endpoints
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', time: new Date().toISOString() });
});

// PWA Web Share Target endpoint ("Bagikan -> Akuntan AI")
app.post('/api/share-target', async (c) => {
  console.log('[Share-Target] Incoming Web Share Target request');
  try {
    let fileObj: File | null = null;
    let title = '';
    let text = '';

    // 1. Extract from multipart FormData
    try {
      const formData = await c.req.formData();
      for (const [key, val] of formData.entries()) {
        if (val && typeof val === 'object' && 'arrayBuffer' in val && (val as File).size > 0) {
          if (!fileObj) {
            fileObj = val as File;
            console.log(
              `[Share-Target] Found file in "${key}": ${fileObj.name} (${fileObj.type}, ${fileObj.size} bytes)`
            );
          }
        } else if (typeof val === 'string' && val.trim()) {
          if (key === 'title') title = val.trim();
          else if (key === 'text') text = text ? `${text} - ${val.trim()}` : val.trim();
          else if (key === 'url') text = text ? `${text} ${val.trim()}` : val.trim();
          else text = text ? `${text} - ${val.trim()}` : val.trim();
        }
      }
    } catch (formErr) {
      console.warn(
        '[Share-Target] formData() parsing error, falling back to parseBody():',
        formErr
      );
      const body = await c.req.parseBody({ all: true });
      for (const [key, val] of Object.entries(body)) {
        if (val && typeof val === 'object' && 'arrayBuffer' in val && (val as File).size > 0) {
          if (!fileObj) fileObj = val as File;
        } else if (
          Array.isArray(val) &&
          val.length > 0 &&
          typeof val[0] === 'object' &&
          'arrayBuffer' in val[0]
        ) {
          if (!fileObj) fileObj = val[0] as File;
        } else if (typeof val === 'string' && val.trim()) {
          if (key === 'title') title = val.trim();
          else if (key === 'text') text = text ? `${text} - ${val.trim()}` : val.trim();
          else if (key === 'url') text = text ? `${text} ${val.trim()}` : val.trim();
        }
      }
    }

    let imageBase64 = '';
    if (fileObj) {
      const buffer = await fileObj.arrayBuffer();
      const mimeType = fileObj.type || 'image/jpeg';
      const b64 = Buffer.from(buffer).toString('base64');
      imageBase64 = `data:${mimeType};base64,${b64}`;
      console.log(`[Share-Target] Converted receipt to base64, size: ${b64.length} chars`);
    }

    const hasData = Boolean(imageBase64 || title || text);
    const payloadJson = JSON.stringify({
      imageBase64: imageBase64 || undefined,
      title: title || undefined,
      text: text || undefined
    });

    console.log(
      `[Share-Target] Preparing transition HTML, hasData: ${hasData}, payload size: ${payloadJson.length} bytes`
    );

    return c.html(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Menerima Bukti QRIS...</title>
</head>
<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc;color:#0f172a;">
  <div style="text-align:center;padding:20px;">
    <div style="font-size:36px;margin-bottom:12px;">📲</div>
    <p style="font-weight:700;font-size:16px;margin:0 0 8px 0;">Menerima Bukti Pembayaran QRIS...</p>
    <p style="color:#64748b;font-size:13px;margin:0;">Membuka Akuntan AI...</p>
    <script>
      (function() {
        var hasData = ${hasData};
        var rawPayload = ${JSON.stringify(payloadJson)};

        function redirect() {
          window.location.replace('/?shared_receipt=1');
        }

        if (!hasData) {
          // If no data arrived (e.g. Android intent dropped file stream),
          // clear previous storage so client activates the fallback scanner directly
          try { localStorage.removeItem('akuntan_shared_receipt'); } catch (e) {}
          try { sessionStorage.removeItem('akuntan_shared_receipt'); } catch (e) {}
          try {
            var req = indexedDB.open('akuntan_share_db', 1);
            req.onsuccess = function(e) {
              var db = e.target.result;
              if (db.objectStoreNames.contains('shares')) {
                var tx = db.transaction('shares', 'readwrite');
                tx.objectStore('shares').delete('latest');
                tx.oncomplete = function() { redirect(); };
                tx.onerror = function() { redirect(); };
              } else {
                redirect();
              }
            };
            req.onerror = function() { redirect(); };
            setTimeout(redirect, 600);
          } catch (e) {
            redirect();
          }
          return;
        }

        // 1. Fallback sync storage (for smaller text / low-res)
        try { localStorage.setItem('akuntan_shared_receipt', rawPayload); } catch (e) {}
        try { sessionStorage.setItem('akuntan_shared_receipt', rawPayload); } catch (e) {}

        // 2. Primary reliable storage: IndexedDB (handles large images without 5MB quota limits)
        try {
          var req = indexedDB.open('akuntan_share_db', 1);
          req.onupgradeneeded = function(e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains('shares')) {
              db.createObjectStore('shares', { keyPath: 'id' });
            }
          };
          req.onsuccess = function(e) {
            try {
              var db = e.target.result;
              var tx = db.transaction('shares', 'readwrite');
              tx.objectStore('shares').put({ id: 'latest', payload: JSON.parse(rawPayload), timestamp: Date.now() });
              tx.oncomplete = function() { redirect(); };
              tx.onerror = function() { redirect(); };
            } catch (err) {
              redirect();
            }
          };
          req.onerror = function() { redirect(); };
          setTimeout(redirect, 1200);
        } catch (e) {
          redirect();
        }
      })();
    </script>
  </div>
</body>
</html>`);
  } catch (err) {
    console.error('[Share-Target] Unhandled error in share-target:', err);
    return c.redirect('/?shared_receipt=1');
  }
});

// Protect all non-auth, non-health, non-webhook API routes
app.use('/api/transactions/*', authMiddleware);
app.use('/api/transactions', authMiddleware);
app.use('/api/chat/*', authMiddleware);
app.use('/api/chat', authMiddleware);
app.use('/api/ai-quota/*', authMiddleware);
app.use('/api/ai-quota', authMiddleware);
app.use('/api/scan-receipt/*', authMiddleware);
app.use('/api/scan-receipt', authMiddleware);
app.use('/api/analytics/*', authMiddleware);
app.use('/api/analytics', authMiddleware);
app.use('/api/debts/*', authMiddleware);
app.use('/api/debts', authMiddleware);
app.use('/api/budgets/*', authMiddleware);
app.use('/api/budgets', authMiddleware);
app.use('/api/export/*', authMiddleware);
app.use('/api/export', authMiddleware);

const apiRoutes = app
  .route('/api/auth', authRoute)
  .route('/api/webhooks', webhooksRoute)
  .route('/api/transactions', transactionsRoute)
  .route('/api/chat', chatRoute)
  .route('/api/ai-quota', aiQuotaRoute)
  .route('/api/scan-receipt', scanReceiptRoute)
  .route('/api/analytics', analyticsRoute)
  .route('/api/debts', debtsRoute)
  .route('/api/budgets', budgetsRoute)
  .route('/api/export', exportRoute);

// Fallback for static assets and client-side PWA routing
app.all('*', (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text('Not found', 404);
});

export type AppType = typeof apiRoutes;
export default app;
