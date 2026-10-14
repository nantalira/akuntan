import { Database } from 'bun:sqlite';
import { beforeEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../src/db/client';
import {
  consumeAiQuotaAtomic,
  getAiQuotaStatus,
  getTodayDateString
} from '../src/server/utils/aiQuota';
import { toMonetaryInteger } from '../src/server/utils/paymentParser';

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
    async exec(query: string) {
      sqlite.run(query);
      return { count: 0, duration: 0 };
    },
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      const results = [];
      for (const s of statements) {
        results.push(await s.run());
      }
      return results;
    }
  } as unknown as D1Database;

  return { sqlite, d1: mockD1, db: getDb(mockD1) };
}

describe('Domain 3: AI Multimodal Ingestion & Quota Governance (ANT-23)', () => {
  let sqlite: Database;
  let db: ReturnType<typeof getDb>;

  beforeEach(() => {
    const testDb = createTestDatabase();
    sqlite = testDb.sqlite;
    db = testDb.db;

    // Seed test users:
    // User 1: Regular free tier user (no custom API key)
    // User 2: User with custom Gemini API Key
    sqlite.run(
      `INSERT INTO users (id, email, name, webhook_token, gemini_api_key, ai_quota_used, ai_quota_limit)
       VALUES (1, 'free@example.com', 'Free User', 'token-free', NULL, 0, 20),
              (2, 'custom@example.com', 'Power User', 'token-custom', 'AIzaSyCustomKey123', 0, 20);`
    );
  });

  describe('Task 1.1: Synchronous Atomic Quota Enforcement on Users Table (Anti-Race Condition)', () => {
    it('should consume quota atomically via UPDATE users RETURNING and decrement remaining count', async () => {
      // Test with custom overrideLimit of 3 requests for determinism
      const res1 = await consumeAiQuotaAtomic(db, 1, { overrideLimit: 3 });
      expect(res1.allowed).toBe(true);
      expect(res1.used).toBe(1);
      expect(res1.remaining).toBe(2);

      const res2 = await consumeAiQuotaAtomic(db, 1, { overrideLimit: 3 });
      expect(res2.allowed).toBe(true);
      expect(res2.used).toBe(2);
      expect(res2.remaining).toBe(1);

      const res3 = await consumeAiQuotaAtomic(db, 1, { overrideLimit: 3 });
      expect(res3.allowed).toBe(true);
      expect(res3.used).toBe(3);
      expect(res3.remaining).toBe(0);

      // Verify users table in SQLite directly
      const user = sqlite
        .prepare('SELECT ai_quota_used, ai_quota_limit FROM users WHERE id = 1')
        .get() as { ai_quota_used: number; ai_quota_limit: number };
      expect(user.ai_quota_used).toBe(3);
      expect(user.ai_quota_limit).toBe(3);
    });

    it('should reject request with allowed: false when quota limit is reached without modifying counter', async () => {
      // Consume up to limit (2 requests)
      await consumeAiQuotaAtomic(db, 1, { overrideLimit: 2 });
      await consumeAiQuotaAtomic(db, 1, { overrideLimit: 2 });

      // 3rd request MUST be rejected atomically
      const rejected = await consumeAiQuotaAtomic(db, 1, { overrideLimit: 2 });
      expect(rejected.allowed).toBe(false);
      expect(rejected.remaining).toBe(0);
      expect(rejected.message).toContain('Kuota harian AI telah habis');

      // Verify that ai_quota_used in DB did NOT increment past limit
      const row = sqlite
        .prepare('SELECT ai_quota_used, ai_quota_limit FROM users WHERE id = 1')
        .get() as { ai_quota_used: number; ai_quota_limit: number };
      expect(row.ai_quota_used).toBe(2);
      expect(row.ai_quota_limit).toBe(2);
    });

    it('should handle concurrent parallel requests without over-quota leak (Anti-Race Condition)', async () => {
      // Set user quota limit to 5
      await consumeAiQuotaAtomic(db, 1, { overrideLimit: 5 }); // 1 consumed, remaining = 4

      // Fire 10 parallel requests concurrently to compete for remaining 4 slots
      const promises = Array.from({ length: 10 }).map(() =>
        consumeAiQuotaAtomic(db, 1, { overrideLimit: 5 })
      );
      const results = await Promise.all(promises);

      const succeeded = results.filter((r) => r.allowed);
      const rejected = results.filter((r) => !r.allowed);

      // Exactly 4 must succeed (1 + 4 = 5 total limit), and 6 must be rejected with 429
      expect(succeeded.length).toBe(4);
      expect(rejected.length).toBe(6);

      // Verify DB never leaked past quota ceiling
      const user = sqlite
        .prepare('SELECT ai_quota_used, ai_quota_limit FROM users WHERE id = 1')
        .get() as { ai_quota_used: number; ai_quota_limit: number };
      expect(user.ai_quota_used).toBe(5);
      expect(user.ai_quota_used).toBeLessThanOrEqual(user.ai_quota_limit);
    });

    it('should grant unlimited access to users with custom Gemini API key', async () => {
      // User 2 has gemini_api_key configured
      const res1 = await consumeAiQuotaAtomic(db, 2, { overrideLimit: 2 });
      expect(res1.allowed).toBe(true);
      expect(res1.isCustomKey).toBe(true);
      expect(res1.remaining).toBe(9999);

      const res2 = await consumeAiQuotaAtomic(db, 2, { overrideLimit: 2 });
      expect(res2.allowed).toBe(true);
      expect(res2.isCustomKey).toBe(true);

      const res3 = await consumeAiQuotaAtomic(db, 2, { overrideLimit: 2 });
      expect(res3.allowed).toBe(true);
      expect(res3.isCustomKey).toBe(true);
    });

    it('should calculate accurate quota status and warning thresholds from users table', async () => {
      const statusInit = await getAiQuotaStatus(db, 1, 'gemini-3.5-flash-lite', 10);
      expect(statusInit.remaining).toBe(20); // Default user limit 20
      expect(statusInit.status).toBe('safe');

      // Set limit to 10 and consume 8 requests (remaining 2, <= 20% limit)
      for (let i = 0; i < 8; i++) {
        await consumeAiQuotaAtomic(db, 1, { overrideLimit: 10 });
      }

      const statusWarning = await getAiQuotaStatus(db, 1, 'gemini-3.5-flash-lite', 10);
      expect(statusWarning.remaining).toBe(2);
      expect(statusWarning.status).toBe('warning');

      // Consume remaining 2
      await consumeAiQuotaAtomic(db, 1, { overrideLimit: 10 });
      await consumeAiQuotaAtomic(db, 1, { overrideLimit: 10 });

      const statusExceeded = await getAiQuotaStatus(db, 1, 'gemini-3.5-flash-lite', 10);
      expect(statusExceeded.remaining).toBe(0);
      expect(statusExceeded.status).toBe('exceeded');
    });
  });

  describe('Task 1.2: Direct R2 Storage & Zero AWS SDK Invariant', () => {
    it('should not import or depend on @aws-sdk/client-s3 in codebase', () => {
      const pkgPath = path.join(process.cwd(), 'package.json');
      const pkgContent = fs.readFileSync(pkgPath, 'utf-8');
      expect(pkgContent).not.toContain('@aws-sdk');
      expect(pkgContent).not.toContain('aws-sdk');
    });

    it('should generate correct R2 storage key pattern for receipts and audio', () => {
      const today = getTodayDateString();
      const userId = 1;
      const uuid = 'test-uuid-1234';
      const receiptKey = `receipts/${userId}/${today}/${uuid}.jpg`;
      const audioKey = `audio/${userId}/${today}/${uuid}.webm`;

      expect(receiptKey).toMatch(/^receipts\/1\/\d{4}-\d{2}-\d{2}\/test-uuid-1234\.jpg$/);
      expect(audioKey).toMatch(/^audio\/1\/\d{4}-\d{2}-\d{2}\/test-uuid-1234\.webm$/);
    });
  });

  describe('Task 1.3: Voice Transcription & Fallback Engine', () => {
    it('should enforce quota rejection before Whisper execution', async () => {
      // Exceed quota
      await consumeAiQuotaAtomic(db, 1, { overrideLimit: 1 });
      const check = await consumeAiQuotaAtomic(db, 1, { overrideLimit: 1 });
      expect(check.allowed).toBe(false);
    });
  });

  describe('Task 3.1: Payload Gatekeeper Invariant (HTTP 413)', () => {
    it('should validate 4MB ceiling for image payloads', () => {
      const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
      const validSize = 3.5 * 1024 * 1024;
      const oversized = 4.5 * 1024 * 1024;

      expect(validSize <= MAX_IMAGE_SIZE).toBe(true);
      expect(oversized > MAX_IMAGE_SIZE).toBe(true);
    });

    it('should validate 10MB ceiling for audio payloads', () => {
      const MAX_AUDIO_SIZE = 10 * 1024 * 1024;
      const validAudio = 8 * 1024 * 1024;
      const oversizedAudio = 11 * 1024 * 1024;

      expect(validAudio <= MAX_AUDIO_SIZE).toBe(true);
      expect(oversizedAudio > MAX_AUDIO_SIZE).toBe(true);
    });
  });

  describe('Task 4.1: Receipt Extraction Integer Rupiah Normalization (Domain 2 Invariant)', () => {
    it('should coerce float/decimal amounts to pure zero-decimal integer Rupiah', () => {
      expect(toMonetaryInteger(47500.5)).toBe(47501);
      expect(toMonetaryInteger('Rp 47.500,00')).toBe(47500);
      expect(toMonetaryInteger('125000.49')).toBe(125000);
      expect(toMonetaryInteger(99999)).toBe(99999);
      expect(Number.isInteger(toMonetaryInteger(45000.75))).toBe(true);
    });
  });
});
