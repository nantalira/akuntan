---
change: domain-4-webhooks-sync
archived_at: 2026-10-14T22:45:00+07:00
kaneo_sync: completed
synced_at: 2026-10-14T22:54:00+07:00
ticket_id: ANT-24
---

# Domain 4 Walkthrough: Payment Integrations, Webhooks & Cloud Sync (ANT-24)

## Executive Summary
Domain 4 mengimplementasikan arsitektur integrasi ekosistem pembayaran (Midtrans QRIS/E-Wallet), verifikasi webhook kriptografis, dan sinkronisasi awan Google Sheets secara asinkron dengan **prinsip 100% Zero-Cost / Free-Tier Only**:
1. **D1 Outbox Pattern + Scheduled Cron Triggers (Zero-Cost Queue Alternative):** Menggantikan Cloudflare Queues berbayar ($5/bln) dengan tabel `sync_outbox` di D1 SQLite. Event diproses non-blocking via `ctx.waitUntil()` saat webhook tiba dan diamankan oleh Cloudflare Scheduled Cron Triggers gratis (`*/5 * * * *`).
2. **Timing-Safe Cryptographic Webhook Verification:** Verifikasi signature HMAC-SHA256 dan Midtrans SHA-512 menggunakan Web Crypto API dan `crypto.timingSafeEqual` pada raw request body mendahului parsing JSON untuk memitigasi serangan side-channel timing attack.
3. **Idempotent Billing & Webhook Mutations:** Pengecekan ID transaksi/referensi di Cloudflare D1 mencegah mutasi billing dan pencatatan kas ganda. Endpoint webhook membalas dengan HTTP 200 dalam waktu < 2.500 ms.
4. **Edge Streaming Data Export:** Mendukung pengunduhan data buku kas langsung dari edge Worker dalam format CSV (dengan BOM UTF-8) dan format JSON (`?format=json`).
5. **Strict Type Safety Resolution:** Menuntaskan seluruh isu kompilasi tipe TypeScript (`tsc`) pada `db.batch` Drizzle dan variabel chat route yang sebelumnya sempat memicu kegagalan pipeline CI GitHub Actions.

---

## File Footprint (`git diff --stat`)
```text
 drizzle/0009_create_sync_outbox.sql                |  16 +++
 drizzle/meta/_journal.json                         |  14 ++
 openspec/specs/data-export/spec.md                 |   8 +
 .../specs/gmail-oauth-and-sheet-template/spec.md   |   8 +
 openspec/specs/qris-and-wallets/spec.md            |   8 +
 openspec/specs/qris-share-and-webhook/spec.md      |   8 +
 openspec/specs/sheet-management/spec.md            |   8 +
 src/db/schema.ts                                   |  23 +++
 src/server/index.ts                                |  16 +-
 src/server/routes/budgets.ts                       |   3 +-
 src/server/routes/chat.ts                          |  11 +-
 src/server/routes/export.ts                        |  14 +-
 src/server/routes/transactions.ts                  |  22 ++-
 src/server/routes/webhooks.ts                      | 182 ++++++++++++++++++++-
 src/server/utils/outbox.ts                         | 182 ++++++++++++++++++++-
 test/domain-4-webhooks-sync.test.ts                | 310 +++++++++++++++++++++++++++++++++++
 wrangler.jsonc                                     |   3 +
 17 files changed, 629 insertions(+), 25 deletions(-)
```

---

## Key Changes & Implementations
1. **D1 Schema & Migration (`src/db/schema.ts` & `drizzle/0009_create_sync_outbox.sql`):**
   - Menambahkan tabel `sync_outbox` dengan kolom `id`, `user_id` (FK cascade ke `users.id`), `target`, `payload`, `status` (`pending|processing|completed|failed`), `attempts`, `last_error`, `created_at`, `updated_at`.
   - Menambahkan indeks komposit `idx_sync_outbox_status` dan `idx_sync_outbox_user_status`.
   - Migrasi D1 `0009_create_sync_outbox.sql` telah diaplikasikan ke database D1 lokal.
2. **Timing-Safe Cryptography & Outbox Processor (`src/server/utils/outbox.ts`):**
   - `verifyWebhookSignature`: Verifikasi HMAC-SHA256 dan SHA-512 constant-time.
   - `timingSafeEqualString`: Membandingkan buffer byte menggunakan `crypto.timingSafeEqual` dengan proteksi length-mismatch.
   - `enqueueOutboxItem`: Memasukkan antrean tugas asinkron ke tabel `sync_outbox`.
   - `processSyncOutbox`: Memproses antrean berstatus pending secara batch, memperbarui counter percobaan dan status penyelesaian.
3. **Midtrans Webhook & Ingestion Route (`src/server/routes/webhooks.ts`):**
   - Menambahkan route `POST /api/webhooks/midtrans` dengan pembacaan raw-body mendahului validasi signature.
   - Idempotensi instan terhadap `referenceId` transaksi yang sudah ada.
   - Klasifikasi otomatis metode pembayaran (`GoPay`, `ShopeePay`, `Transfer`, `Indomaret/Alfamart`, `QRIS`).
   - Penjadwalan eksekusi outbox non-blocking via `c.executionCtx.waitUntil(processSyncOutbox(c.env))`.
4. **Scheduled Worker Triggers & Export Enhancement (`wrangler.jsonc`, `index.ts`, `export.ts`):**
   - Menambahkan konfigurasi triggers cron `["*/5 * * * *"]` pada `wrangler.jsonc`.
   - Mengekspor scheduled handler pada Cloudflare Workers entrypoint di `src/server/index.ts`.
   - Memperluas `/api/export` untuk mendukung format `json` via `?format=json` di samping CSV streaming.
5. **Strict Type Safety Cleanliness:**
   - Memperbaiki pengetikan generic tuple `BatchItem<'sqlite'>` pada `db.batch` di `budgets.ts`, `chat.ts`, dan `transactions.ts`.
   - Memperbaiki referensi variabel `insertedRow` di `chat.ts`.
   - `bun run check` (`tsc --noEmit && biome check .`) menghasilkan 0 error dan 0 warning.

---

## Edge Invariants & Guardrails Checklist
- [x] **Zero-Decimal Integer Currency:** Seluruh nominal pembayaran dan mutasi outbox dinormalisasi ke integer Rupiah murni tanpa pecahan desimal.
- [x] **Strict Tenant Isolation:** Seluruh item outbox dan transaksi terikat `user_id` dengan relasi foreign key cascade aktif (`PRAGMA foreign_keys = ON;`).
- [x] **Cloudflare Workers Edge Constraints:** Menggunakan Web Crypto API dan `node:crypto` native; bebas dari library berat pihak ketiga.
- [x] **Zero-Cost Free-Tier Invariants:** Menggunakan D1 Outbox Pattern + Cloudflare Scheduled Cron Triggers (100% gratis), tanpa Cloudflare Queues berbayar ($5/bln).
- [x] **Zero Type Escapes:** Bebas dari `any`, `@ts-ignore`, atau suppress linter.
- [x] **Strict Local-Only Execution:** Seluruh migrasi D1 dan pengujian dijalankan lokal (`--local`).

---

## Synced Main Specs
- `openspec/specs/data-export/spec.md`: Ditambahkan requirement Streaming Edge Data Export (CSV & JSON).
- `openspec/specs/gmail-oauth-and-sheet-template/spec.md`: Ditambahkan requirement Encrypted OAuth Token Storage Invariant.
- `openspec/specs/qris-and-wallets/spec.md`: Ditambahkan requirement Payment Method Metadata Classification.
- `openspec/specs/qris-share-and-webhook/spec.md`: Ditambahkan requirement Timing-Safe Webhook Cryptographic Verification.
- `openspec/specs/sheet-management/spec.md`: Ditambahkan requirement Non-Blocking Google Sheets Outbox Sync.

---

## Quality & Verification Results
- **TypeScript & Biome Check (`bun run check`):**
  ```text
  $ tsc --noEmit && biome check .
  Checked 68 files in 61ms. No fixes applied.
  Found 0 errors, 0 warnings.
  ```
- **Automated Tests Passing (`bun test`):**
  ```text
  35 pass
  0 fail
  148 expect() calls
  Ran 35 tests across 4 files. [406.00ms]
  ```
- **Local D1 Migration:**
  `0009_create_sync_outbox.sql` diterapkan sukses pada D1 database lokal `akuntan-db`.
