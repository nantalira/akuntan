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
  try {
    const body = await c.req.parseBody();
    const title = typeof body.title === 'string' ? body.title : '';
    const text = typeof body.text === 'string' ? body.text : '';
    const receipt = body.receipt;

    let imageBase64 = '';
    if (receipt && typeof receipt === 'object' && 'arrayBuffer' in receipt) {
      const fileObj = receipt as File;
      const buffer = await fileObj.arrayBuffer();
      const mimeType = fileObj.type || 'image/jpeg';
      const b64 = Buffer.from(buffer).toString('base64');
      imageBase64 = `data:${mimeType};base64,${b64}`;
    }

    const payloadJson = JSON.stringify({
      imageBase64: imageBase64 || undefined,
      title: title || undefined,
      text: text || undefined
    });

    return c.html(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Memproses Bukti QRIS...</title>
</head>
<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc;color:#0f172a;">
  <div style="text-align:center;">
    <p style="font-weight:600;">📲 Menerima Bukti Pembayaran QRIS...</p>
    <script>
      try {
        localStorage.setItem('akuntan_shared_receipt', ${JSON.stringify(payloadJson)});
      } catch (e) {
        try {
          sessionStorage.setItem('akuntan_shared_receipt', ${JSON.stringify(payloadJson)});
        } catch (_err) {}
      }
      window.location.replace('/?shared_receipt=1');
    </script>
  </div>
</body>
</html>`);
  } catch {
    return c.redirect('/');
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
