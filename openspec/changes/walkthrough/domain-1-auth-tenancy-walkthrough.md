---
change: domain-1-auth-tenancy
archived_at: 2026-10-12T16:44:00+07:00
kaneo_sync: completed
synced_at: 2026-10-13T10:24:51+07:00
ticket_id: ANT-21
---

# Walkthrough: Domain 1 - Identity, Authentication & Multi-Tenant Isolation

## Executive Summary
Domain 1 (`domain-1-auth-tenancy`, Kaneo Task `ANT-21`) establishes strict tenant isolation and relational integrity across the SQLite D1 database. The legacy `.default(1)` fallback on `user_id` has been completely purged, foreign key constraints with `ON DELETE CASCADE` are enforced across all child entity tables (`transactions`, `debts`, `budgets`, `categories`, `ai_usage`), and per-request `PRAGMA foreign_keys = ON;` is guaranteed in Hono server middleware. In addition, composite query indexes were established for high-performance tenant range queries, and automatic batch provisioning of 6 default categories upon user registration was implemented.

## 📊 File Footprint (`git diff --stat`)
```text
 bun.lock                              |   5 +
 drizzle/0007_faithful_sleepwalker.sql |  88 ++++
 drizzle/meta/0007_snapshot.json       | 618 ++++++++++++++++++++++++
 drizzle/meta/_journal.json            |   7 +
 package.json                          |   5 +-
 src/client/components/ChatDrawer.tsx  |   5 +-
 src/client/components/Dashboard.tsx   |   2 +-
 src/client/components/ProfileModal.tsx|   2 +-
 src/client/hooks/useAiQuota.ts        |   4 +-
 src/db/client.ts                      |   6 +
 src/db/schema.ts                      |  22 +-
 src/server/index.ts                   |   8 +
 src/server/routes/auth.ts             |  13 +-
 src/server/utils/auth.ts              |   4 +-
 test/auth-tenancy.test.ts             | 184 +++++++
 tsconfig.json                         |   4 +-
 16 files changed, 970 insertions(+), 17 deletions(-)
```

## Key Changes
1. **Schema & Relational Integrity (`src/db/schema.ts`)**:
   - Eliminated `.default(1)` fallback from all tenant-scoped tables.
   - Enforced `.references(() => users.id, { onDelete: 'cascade' })` across `transactions`, `debts`, `budgets`, `categories`, and `ai_usage`.
   - Added composite indexes `idx_transactions_user_date` (`user_id`, `date`) and `idx_transactions_user_id_composite` (`user_id`, `id`) on `transactions`.
2. **Database Middleware & Connection Pragma (`src/db/client.ts`, `src/server/index.ts`)**:
   - Added `initDbWithPragma(c.env.DB)` executing `PRAGMA foreign_keys = ON;` on every D1 database connection instance.
3. **Registration Category Seeding (`src/server/routes/auth.ts`)**:
   - Added atomic batch seeding of 6 standard categories (`Makan`, `Jajan`, `Primer`, `Transport`, `Olga`, `Belanja`) with distinct colors and icons immediately upon user registration.
4. **Database Migrations (`drizzle/0007_faithful_sleepwalker.sql`)**:
   - Drizzle migration generated and applied cleanly to local SQLite D1 without data loss or schema drift.
5. **Contract & Automated Testing (`test/auth-tenancy.test.ts`)**:
   - 4 automated contract/integration tests covering:
     - Cascade deletion of all child rows upon user deletion.
     - Foreign key orphan insertion rejection.
     - Strict multi-tenant query isolation between tenants.
     - Atomic provisioning of 6 default categories per new user.

## 🛡️ Edge Invariants & Guardrails Checklist
- [x] **Zero-Decimal Integer Currency**: Nilai moneter dalam ledger menggunakan integer Rupiah tanpa pecahan sen/desimal.
- [x] **Strict Tenant Isolation**: Seluruh query dan mutasi data terikat klausul `WHERE user_id = ?` dan diverifikasi via relasi kaskade D1.
- [x] **Edge Runtime Constraints**: Zero heavy Node.js libraries (menggunakan Web Crypto PBKDF2 edge-native, bundle < 1MB, RAM < 128MB).
- [x] **Zero-Cost Free-Tier Invariants**: D1 atomic counter / SQLite native constraints tanpa dependensi cloud berbayar.
- [x] **Zero Type Escapes**: Bebas dari `any`, `@ts-ignore`, atau casting longgar (`bun run check` lolos 0 errors).
- [x] **Strict Local-Only Execution**: Migrasi D1 dan test dieksekusi 100% pada environment lokal (`--local`), zero remote pollution.

## Synced Main Specs
- `openspec/specs/multi-tenancy/spec.md`:
  - Updated `Strict Per-User Data Isolation Across All Tables` (purged `.default(1)`, included `categories`).
  - Added `Relational Cascade and Foreign Key Enforcement`.
  - Added `Multi-Tenant Composite Query Indexing`.
- `openspec/specs/user-auth/spec.md`:
  - Updated `Protected API Middleware` (added `/api/share-target` exclusion, injected typed user context).
  - Added `Edge Native PBKDF2 Password Security`.
- `openspec/specs/user-onboarding/spec.md`:
  - Added `Atomic Tenant Default Category Provisioning`.

## Quality & Verification Results
- **`bun run check`**: Passed (0 type errors, 0 linter warnings).
- **`bun run test`**: Passed (4/4 tests pass, 21 expect calls, 77ms).
- **`openspec validate --specs`**: Passed (18/18 specs valid).
- **Git Status**: Changes staged & verified (proposed: `feat(auth-tenancy): [ANT-21] enforce foreign key cascades, tenant isolation and composite indexes`).
