---
change: domain-2-core-ledger
archived_at: 2026-10-13T12:28:00+07:00
kaneo_sync: completed
synced_at: 2026-10-13T12:59:45+07:00
ticket_id: ANT-22
---

# Walkthrough: Domain 2 - Core Financial Ledger & Expense Engine

## Executive Summary
Domain 2 (`domain-2-core-ledger`, Kaneo Task `ANT-22`) establishes the core financial ledger and expense ingestion engine on Cloudflare Workers and D1 SQLite. It enforces pure zero-decimal integer Rupiah across the database schema, API input boundaries, and payment parsing utilities, preventing any floating-point rounding inaccuracies. It implements stateless timezone ingestion via the `X-User-Timezone` header (with fallback to `Asia/Jakarta`) using native V8 `Intl.DateTimeFormat` (zero dependencies, free-tier edge compatible). Crucially, all multi-table mutations (inserting transactions, reconciling differential contact debts, adjusting monthly budgets) are encapsulated into atomic `db.batch([...])` operations on Cloudflare D1, preventing race conditions and schema state desynchronization.

## 📊 File Footprint (`git diff --stat`)
```text
 src/server/routes/budgets.ts                         |  15 ++--
 src/server/routes/chat.ts                            | 102 +++++++++-------------
 src/server/routes/debts.ts                           |   2 +-
 src/server/routes/transactions.ts                    | 179 ++++++++++++++++++++++++++++----------
 src/server/utils/debtHelper.ts                       |  34 ++++++--
 src/server/utils/paymentParser.ts                    |  34 +++++++-
 src/server/utils/timezone.ts                         |  92 +++++++++++++++++++
 test/ledger-core.test.ts                             | 315 ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 openspec/specs/budget-tracking/spec.md               |  10 ++
 openspec/specs/category-management/spec.md          |  10 ++
 openspec/specs/debt-settlement/spec.md               |  10 ++
 openspec/specs/expense-tracking/spec.md              |  18 ++++
 openspec/specs/frequent-expense-autocomplete/spec.md |  10 ++
 13 files changed, 687 insertions(+), 134 deletions(-)
```

## Key Changes
1. **Integer Monetary Currency Standard (`src/server/utils/paymentParser.ts`, `src/server/routes/transactions.ts`, `src/server/routes/budgets.ts`, `src/server/routes/debts.ts`)**:
   - Added `isValidMonetaryInteger` and `toMonetaryInteger` helpers ensuring positive safe integers and zero-decimal Rupiah.
   - Enforced `.int()` on all Zod input validation schemas for transaction `amount`, `debtAmount`, and budget `monthlyLimit`.
   - Hardened `parseBankNotificationRegex` and `parseQrisNotificationSmart` against floating-point inaccuracies.
2. **Stateless Timezone Ingestion (`src/server/utils/timezone.ts`, `src/server/routes/transactions.ts`, `src/server/routes/chat.ts`)**:
   - Created `timezone.ts` utilizing native V8 `Intl.DateTimeFormat` (zero external dependencies, 100% Cloudflare Workers edge-compatible).
   - Ingests `X-User-Timezone` header (fallback: `Asia/Jakarta`) to automatically determine local dates/times and convert them to standard ISO UTC timestamps.
3. **D1 Multi-Table Atomic Batching (`src/server/utils/debtHelper.ts`, `src/server/routes/transactions.ts`, `src/server/routes/chat.ts`, `src/server/routes/budgets.ts`)**:
   - Created `getDebtAdjustmentStatement` returning Drizzle statement builders for batch execution.
   - Refactored `POST /api/transactions`, `PUT /api/transactions/:id`, `DELETE /api/transactions/:id`, and `POST /api/chat` to encapsulate transaction mutates and debt balance adjustments in a single atomic `db.batch([...])`.
   - Implemented contact net-delta tracking during transaction edits to handle differential talangan recalculations in a single atomic batch.
   - Refactored budget updates in `budgetsRoute` to utilize `db.batch([...])`.
4. **Contract & Automated Testing (`test/ledger-core.test.ts`)**:
   - 10 automated test cases in `test/ledger-core.test.ts` verifying:
     - Integer currency validation & rejection of decimals/floats.
     - Stateless timezone ingestion across WIB and WITA timezones.
     - Differential debt reconciliation across create, edit, contact change, settlement (`isDebtSettled = 1`), and deletion.
     - Multi-tenant query isolation and pagination with limit and offset without data leakage.
   - Full test suite runs 14 tests across 2 files, passing in ~200ms with zero errors.

## 🛡️ Edge Invariants & Guardrails Checklist
- [x] **Zero-Decimal Integer Currency**: Seluruh nominal transaksi (`amount`), hutang (`debt_amount`), dan budget (`monthly_limit`) diverifikasi strictly sebagai integer Rupiah murni tanpa floating-point desimal.
- [x] **D1 Multi-Table Atomic Batching**: Seluruh mutasi yang melibatkan perhutangan (`debts`), transaksi (`transactions`), dan pagu anggaran (`budgets`) dibungkus dalam `db.batch([...])` atomik.
- [x] **Stateless Timezone Header**: Header `X-User-Timezone` (fallback: `Asia/Jakarta`) dibaca secara stateless menggunakan V8 native `Intl.DateTimeFormat` tanpa query database preferensi tambahan.
- [x] **Strict Tenant Isolation**: Seluruh kueri pembacaan dan pembaruan mutasi terikat klausa `WHERE user_id = :userId` dan indeks komposit `(user_id, date)` serta `(user_id, id)`.
- [x] **Edge Runtime Constraints**: Zero heavy external dependencies (ukuran bundle tetap di bawah 1MB, konsumsi memori jauh di bawah 128MB).
- [x] **Zero-Cost Free-Tier Invariants**: Tidak menggunakan Cloudflare Queues berbayar ataupun model AI tanpa tier gratis.
- [x] **Zero Type & Lint Errors**: `biome check` lulus dengan 0 warning dan 0 error (47 files checked).
- [x] **Strict Local-Only Execution**: Seluruh automated test berjalan pada SQLite in-memory D1 simulasi lokal (`--local`).

## Synced Main Specs
- `openspec/specs/budget-tracking/spec.md`:
  - Added `Atomic Budget Deduction with Integer Currency`.
- `openspec/specs/category-management/spec.md`:
  - Added `Dynamic Category Persistence with Strict Tenancy`.
- `openspec/specs/debt-settlement/spec.md`:
  - Added `Atomic Talangan Reconciliation Batch`.
- `openspec/specs/expense-tracking/spec.md`:
  - Added `Stateless Timezone Ingestion`.
  - Added `Multi-Table Atomic Batching`.
- `openspec/specs/frequent-expense-autocomplete/spec.md`:
  - Added `Indexed Frequent Expense Query`.

## Quality & Verification Results
- **`biome check src/ test/`**: Passed (0 errors, 0 warnings, 47 files clean).
- **`bun test`**: Passed (14/14 tests pass, 70 expect calls, 202ms).
- **Kaneo Sync Status**: `pending` (siap disinkronkan via `/kaneo-sync`).
