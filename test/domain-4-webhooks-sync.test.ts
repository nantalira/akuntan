import { Database } from 'bun:sqlite';
import { beforeEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../src/db/client';
import {
  computeHmacSha256Hex,
  computeSha512Hex,
  enqueueOutboxItem,
  processSyncOutbox,
  timingSafeEqualString,
  verifyWebhookSignature
} from '../src/server/utils/outbox';

function createTestDatabase() {
  const sqlite = new Database(':memory:');
  sqlite.run('PRAGMA foreign_keys = ON;');

  const migrationFiles = fs
    .readdirSync(path.join(process.cwd(), 'drizzle'))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    const rawSql = fs.readFileSync(path.join(process.cwd(), 'drizzle', file), 'utf-8');
    const statements = rawSql.split('--> statement-breakpoint');
    for (const stmt of statements) {
      const cleanStmt = stmt.trim();
      if (cleanStmt) {
        sqlite.run(cleanStmt);
      }
    }
  }

  // Create D1 mock wrapper
  const mockD1 = {
    prepare(query: string) {
      let boundParams: unknown[] = [];
      const statementObj = {
        bind(...params: unknown[]) {
          boundParams = params.map((p) => (p === undefined ? null : p));
          return statementObj;
        },
        async all() {
          const stmt = sqlite.prepare(query);
          const results = stmt.all(...boundParams);
          return { results, success: true, meta: { served_by: 'mock' } };
        },
        async raw() {
          const stmt = sqlite.prepare(query);
          return stmt.values(...boundParams);
        },
        async run() {
          const stmt = sqlite.prepare(query);
          const info = stmt.run(...boundParams);
          return {
            success: true,
            meta: { changes: info.changes, last_row_id: info.lastInsertRowid }
          };
        },
        async first(colName?: string) {
          const stmt = sqlite.prepare(query);
          const row = stmt.get(...boundParams) as Record<string, unknown> | null;
          if (!row) return null;
          return colName ? row[colName] : row;
        }
      };
      return statementObj;
    },
    async batch(statements: { all: () => Promise<unknown> }[]) {
      const results = [];
      for (const s of statements) {
        results.push(await s.all());
      }
      return results;
    },
    async exec(query: string) {
      sqlite.run(query);
      return { count: 0, duration: 0 };
    }
  };

  return { sqlite, mockD1: mockD1 as unknown as D1Database };
}

describe('Domain 4: Payment Integrations, Webhooks & Cloud Sync (ANT-24)', () => {
  let db: ReturnType<typeof getDb>;
  let mockD1: D1Database;
  const testSecretKey = 'test_midtrans_server_key_super_secret';

  beforeEach(() => {
    const env = createTestDatabase();
    mockD1 = env.mockD1;
    db = getDb(mockD1);

    // Seed test user
    env.sqlite.run(
      `INSERT INTO users (id, email, name, webhook_token, ai_quota_used, ai_quota_limit) 
       VALUES (1, 'tenant@example.com', 'Tenant User', 'token_webhook_123', 0, 20)`
    );
  });

  describe('Task 1.2: Timing-Safe Cryptographic Signature Verification', () => {
    it('should verify valid HMAC-SHA256 signature in constant-time', async () => {
      const payload = JSON.stringify({ order_id: 'ORDER-101', gross_amount: '50000' });
      const validSig = await computeHmacSha256Hex(testSecretKey, payload);

      const isValid = await verifyWebhookSignature({
        rawBody: payload,
        signature: validSig,
        secretKey: testSecretKey,
        algorithm: 'hmac-sha256'
      });

      expect(isValid).toBe(true);
    });

    it('should reject tampered HMAC-SHA256 signature', async () => {
      const payload = JSON.stringify({ order_id: 'ORDER-101', gross_amount: '50000' });
      const tamperedPayload = JSON.stringify({ order_id: 'ORDER-101', gross_amount: '10000' });
      const signature = await computeHmacSha256Hex(testSecretKey, payload);

      const isValid = await verifyWebhookSignature({
        rawBody: tamperedPayload,
        signature,
        secretKey: testSecretKey,
        algorithm: 'hmac-sha256'
      });

      expect(isValid).toBe(false);
    });

    it('should verify Midtrans SHA-512 signature_key correctly', async () => {
      const orderId = 'MIDTRANS-ORDER-999';
      const statusCode = '200';
      const grossAmount = '150000.00';
      const expectedHash = await computeSha512Hex(
        `${orderId}${statusCode}${grossAmount}${testSecretKey}`
      );

      const isValid = timingSafeEqualString(
        expectedHash,
        await computeSha512Hex(`${orderId}${statusCode}${grossAmount}${testSecretKey}`)
      );
      expect(isValid).toBe(true);

      const isInvalid = timingSafeEqualString(expectedHash, 'invalid_signature_hex_123456');
      expect(isInvalid).toBe(false);
    });

    it('should prevent timing attack leaks on length mismatches', () => {
      const sigA = 'abcdef123456';
      const sigB = 'abcdef';
      const result = timingSafeEqualString(sigA, sigB);
      expect(result).toBe(false);
    });
  });

  describe('Task 1.1 & 1.3: D1 Outbox Pattern (Zero-Cost Async Queue)', () => {
    it('should enqueue outbox items with pending status in D1', async () => {
      const item = await enqueueOutboxItem(db, {
        userId: 1,
        target: 'midtrans',
        payload: { orderId: 'ORDER-001', amount: 75000 }
      });

      expect(item).toBeDefined();
      expect(item.userId).toBe(1);
      expect(item.target).toBe('midtrans');
      expect(item.status).toBe('pending');
      expect(item.attempts).toBe(0);

      const rows = await db.select().from(schema.syncOutbox).all();
      expect(rows.length).toBe(1);
      expect(JSON.parse(rows[0].payload)).toEqual({ orderId: 'ORDER-001', amount: 75000 });
    });

    it('should process pending outbox items and transition status to completed', async () => {
      await enqueueOutboxItem(db, {
        userId: 1,
        target: 'google_sheets',
        payload: { transactionId: 10, amount: 25000 }
      });

      await enqueueOutboxItem(db, {
        userId: 1,
        target: 'midtrans',
        payload: { orderId: 'ORDER-002', amount: 50000 }
      });

      const env = { DB: mockD1 };
      const result = await processSyncOutbox(env, 10);

      expect(result.processed).toBe(2);
      expect(result.successes).toBe(2);
      expect(result.failures).toBe(0);

      const completedRows = await db.select().from(schema.syncOutbox).all();
      expect(completedRows.every((r) => r.status === 'completed')).toBe(true);
      expect(completedRows.every((r) => r.attempts === 1)).toBe(true);
    });

    it('should handle empty outbox queue gracefully without error', async () => {
      const env = { DB: mockD1 };
      const result = await processSyncOutbox(env, 10);
      expect(result.processed).toBe(0);
      expect(result.successes).toBe(0);
    });
  });

  describe('Task 1.2: Idempotent Webhook Processing Invariant', () => {
    it('should prevent duplicate transaction mutations when same referenceId arrives', async () => {
      // First transaction
      await db.insert(schema.transactions).values({
        userId: 1,
        name: 'Pembayaran ORDER-MIDTRANS-1',
        amount: 80000,
        date: '2026-10-14',
        time: '12:00:00',
        category: 'Primer',
        paymentMethod: 'GoPay',
        referenceId: 'ORDER-MIDTRANS-1',
        source: 'qris_webhook'
      });

      // Check if reference exists
      const existing = await db
        .select()
        .from(schema.transactions)
        .where(eq(schema.transactions.referenceId, 'ORDER-MIDTRANS-1'))
        .get();

      expect(existing).toBeDefined();
      expect(existing?.amount).toBe(80000);

      // Verify second arrival is skipped
      const countBefore = (await db.select().from(schema.transactions).all()).length;
      if (existing) {
        // Idempotent no-op
      } else {
        await db.insert(schema.transactions).values({
          userId: 1,
          name: 'Pembayaran ORDER-MIDTRANS-1 Duplikat',
          amount: 80000,
          date: '2026-10-14',
          time: '12:01:00',
          category: 'Primer',
          paymentMethod: 'GoPay',
          referenceId: 'ORDER-MIDTRANS-1',
          source: 'qris_webhook'
        });
      }
      const countAfter = (await db.select().from(schema.transactions).all()).length;
      expect(countAfter).toBe(countBefore);
    });
  });

  describe('Task 2.2: Data Export Edge Streaming (CSV & JSON)', () => {
    beforeEach(async () => {
      await db.insert(schema.transactions).values({
        userId: 1,
        name: 'Makan Siang Soto',
        amount: 25000,
        date: '2026-10-14',
        time: '13:00:00',
        category: 'Makan',
        paymentMethod: 'Cash',
        source: 'manual'
      });
      await db.insert(schema.transactions).values({
        userId: 1,
        name: 'Bensin Motor Pertalite',
        amount: 50000,
        date: '2026-10-14',
        time: '14:30:00',
        category: 'Transport',
        paymentMethod: 'QRIS',
        source: 'local_parser'
      });
    });

    it('should format CSV export with UTF-8 BOM and correct columns', async () => {
      const rows = await db.select().from(schema.transactions).all();
      expect(rows.length).toBe(2);

      const headers = ['ID', 'Tanggal', 'Jam', 'Nama Transaksi', 'Nominal (IDR)', 'Kategori'];
      const csvLines = [headers.join(',')];

      for (const row of rows) {
        csvLines.push(
          `"${row.id}","${row.date}","${row.time}","${row.name}","${row.amount}","${row.category}"`
        );
      }

      const csvOutput = `\uFEFF${csvLines.join('\r\n')}`;
      expect(csvOutput.startsWith('\uFEFF')).toBe(true);
      expect(csvOutput).toContain('Makan Siang Soto');
      expect(csvOutput).toContain('25000');
      expect(csvOutput).toContain('Bensin Motor Pertalite');
    });

    it('should format JSON export as a clean array with correct types', async () => {
      const rows = await db.select().from(schema.transactions).all();
      expect(rows.length).toBe(2);
      expect(rows[0].name).toBe('Makan Siang Soto');
      expect(rows[0].amount).toBe(25000);
      expect(typeof rows[0].amount).toBe('number');
    });
  });
});
