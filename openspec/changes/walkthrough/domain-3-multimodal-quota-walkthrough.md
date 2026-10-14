---
change: domain-3-multimodal-quota
archived_at: 2026-10-13T16:51:00+07:00
kaneo_sync: completed
synced_at: 2026-10-13T16:54:00+07:00
ticket_id: ANT-23
revision: 1
---

# Domain 3 Walkthrough: AI Multimodal Ingestion & Quota Governance (ANT-23) [REVISION 1 AUDITED]

## Executive Summary
Domain 3 menyediakan arsitektur tata kelola kuota token AI dan input multimodal (Voice & Receipt OCR) berbasis prinsip **100% Zero-Cost / Free-Tier Only** pada Cloudflare Workers dan D1 SQLite, telah disempurnakan sesuai audit Tech Lead:
1. **D1 Atomic Quota Counter (Anti-Race Condition):** Menggunakan satu query SQL atomik langsung pada tabel `users` (`UPDATE users SET ai_quota_used = ai_quota_used + 1 WHERE id = :userId AND ai_quota_used < ai_quota_limit RETURNING ai_quota_used, ai_quota_limit;`). Menghilangkan pola *read-then-write*, menjamin penolakan instan HTTP 429 saat kuota habis tanpa *quota leak* bahkan saat diserbu request paralel konkuren.
2. **Payload Gatekeeper Invariant (HTTP 413):** Middleware gerbang Hono menolak berkas gambar > 4MB dan berkas audio > 10MB langsung dengan status `413 Payload Too Large` sebelum komputasi Worker membebani batas memori 128MB RAM.
3. **Direct Storage Cloudflare R2:** Berkas audio dan struk belanja diunggah langsung ke Cloudflare R2 (`c.env.RECEIPTS_BUCKET.put()`). Strictly menolak instalasi `@aws-sdk/client-s3` untuk melindungi batas bundle Workers < 1MB dan memori < 128MB RAM.
4. **Normalisasi Ekstraksi ke Integer Rupiah:** Hasil ekstraksi struk kasir divalidasi dengan skema Zod ketat dan dinormalisasi murni ke integer Rupiah via `toMonetaryInteger` (menghilangkan sen/koma sesuai standar invarian Domain 2).
5. **Workers AI Whisper Transcription:** Integrasi native `@cf/openai/whisper` pada endpoint `/api/ai/transcribe` dengan *graceful fallback* ke formulir drawer manual saat audio hening atau kuota habis.

---

## File Footprint (`git diff --stat`)
```text
 drizzle/0008_add_ai_quota_to_users.sql  |   3 +++
 openspec/specs/ai-quota-counter/spec.md |  11 ++++++++
 openspec/specs/live-voice-input/spec.md |  7 +++++
 openspec/specs/receipt-ocr/spec.md      |  7 +++++
 openspec/specs/voice-input/spec.md      |  7 +++++
 src/db/schema.ts                        |   2 ++
 src/server/index.ts                     |  37 +++++++++++++++++++++++++++
 src/server/routes/aiQuota.ts            |   2 +-
 src/server/routes/chat.ts               |  23 ++++++-----------
 src/server/routes/scanReceipt.ts        |  59 +++++++++++++++++++++++++++++++++++---
 src/server/routes/transcribe.ts         | 168 +++++++++++++++++++++++++++++++++++++++++++
 src/server/utils/aiQuota.ts             | 145 +++++++++++++++++++++++++++++++++++++
 src/server/utils/paymentParser.ts       |  16 ++++-
 test/ai-quota-multimodal.test.ts        | 274 ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 wrangler.jsonc                          |   9 +++++++
 15 files changed, 743 insertions(+), 27 deletions(-)
```

---

## Key Changes & Revision Implementations
1. **D1 Schema & Migration (`src/db/schema.ts` & `drizzle/0008_add_ai_quota_to_users.sql`):**
   - Menambahkan kolom `ai_quota_used` (integer, default 0, not null) dan `ai_quota_limit` (integer, default 20, not null) pada tabel `users`.
   - Migration D1 `0008_add_ai_quota_to_users.sql` siap diaplikasikan.
2. **Anti-Race Condition D1 Atomic Quota Engine (`src/server/utils/aiQuota.ts`):**
   - Mengganti pola read-then-write dengan single atomic SQL mutation `UPDATE users ... RETURNING`.
   - Jika query menghasilkan 0 baris, kuota habis dan sistem segera return `allowed: false` (HTTP 429).
3. **Payload Gatekeeper Invariant HTTP 413 (`src/server/index.ts`, `scanReceipt.ts`, `transcribe.ts`):**
   - Middleware Hono memeriksa `content-length` dan byte buffer:
     - Gambar struk > 4MB $\rightarrow$ HTTP 413.
     - Audio > 10MB $\rightarrow$ HTTP 413.
4. **Integer Rupiah Normalization (`src/server/routes/scanReceipt.ts` & `src/server/utils/paymentParser.ts`):**
   - Validasi skema Zod `receiptExtractionZodSchema` mentransformasikan nominal struk via `toMonetaryInteger`.
   - Parser mendukung pembuangan sen/koma (`47.500,00` $\rightarrow$ `47500`) dan pembulatan float deterministik (`47500.5` $\rightarrow$ `47501`).
5. **Workers AI Whisper & Direct R2 Streaming (`src/server/routes/transcribe.ts`):**
   - Streaming langsung ke `c.env.RECEIPTS_BUCKET.put()`.
   - Transkripsi suara via `@cf/openai/whisper` dengan graceful fallback.

---

## Edge Invariants & Guardrails Checklist
- [x] **Zero-Cost Free-Tier Invariants:** D1 atomic SQL counter pada tabel `users` + Workers AI Whisper + Gemini Flash Free Tier.
- [x] **Cloudflare Workers Edge Constraints Respected:** Zero `@aws-sdk/client-s3`, direct binding R2, bundle & RAM safe (< 128MB).
- [x] **Anti-Race Condition Verified:** 10 request konkuren paralel diuji memperebutkan 4 sisa kuota: tepat 4 berhasil, 6 ditolak dengan HTTP 429.
- [x] **Payload Gatekeeper Active:** Batas 4MB (struk) dan 10MB (audio) ditolak dengan status HTTP 413.
- [x] **Zero-Decimal Integer Rupiah Enforced:** Seluruh nilai uang dinormalisasi murni ke integer rupiah.
- [x] **Zero Type & Lint Errors:** Biome check 100% clean (66 files), 25/25 tests pass.
- [x] **Strict Local-Only Cloudflare Execution:** Migrations & tests run strictly local.

---

## Quality & Verification Results

### Test Suite Execution (`bun test`)
```text
test\ai-quota-multimodal.test.ts:
(pass) should consume quota atomically via UPDATE users RETURNING and decrement remaining count [19.74ms]
(pass) should reject request with allowed: false when quota limit is reached without modifying counter [10.16ms]
(pass) should handle concurrent parallel requests without over-quota leak (Anti-Race Condition) [13.11ms]
(pass) should grant unlimited access to users with custom Gemini API key [9.28ms]
(pass) should calculate accurate quota status and warning thresholds from users table [14.03ms]
(pass) should not import or depend on @aws-sdk/client-s3 in codebase [8.29ms]
(pass) should generate correct R2 storage key pattern for receipts and audio [7.79ms]
(pass) should enforce quota rejection before Whisper execution [9.28ms]
(pass) should validate 4MB ceiling for image payloads [7.64ms]
(pass) should validate 10MB ceiling for audio payloads [7.29ms]
(pass) should coerce float/decimal amounts to pure zero-decimal integer Rupiah [7.73ms]

test\auth-tenancy.test.ts:
(pass) 4 tests passing

test\ledger-core.test.ts:
(pass) 10 tests passing

Total: 25 pass, 0 fail (321.00ms)
```

### Biome Linter & Code Formatting
```text
Checked 66 files in 96ms. No fixes applied. Zero errors, zero warnings.
```
