import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { aiQuotaRoute } from './routes/aiQuota';
import { analyticsRoute } from './routes/analytics';
import { budgetsRoute } from './routes/budgets';
import { chatRoute } from './routes/chat';
import { debtsRoute } from './routes/debts';
import { exportRoute } from './routes/export';
import { scanReceiptRoute } from './routes/scanReceipt';
import { transactionsRoute } from './routes/transactions';

export type Bindings = {
  DB: D1Database;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  APP_PASSCODE?: string;
  AI_DAILY_LIMIT?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('/api/*', cors());

const apiRoutes = app
  .get('/api/health', (c) => {
    return c.json({ status: 'ok', time: new Date().toISOString() });
  })
  .route('/api/transactions', transactionsRoute)
  .route('/api/chat', chatRoute)
  .route('/api/ai-quota', aiQuotaRoute)
  .route('/api/scan-receipt', scanReceiptRoute)
  .route('/api/analytics', analyticsRoute)
  .route('/api/debts', debtsRoute)
  .route('/api/budgets', budgetsRoute)
  .route('/api/export', exportRoute);

export type AppType = typeof apiRoutes;
export default app;
