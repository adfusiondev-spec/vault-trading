# Strategic Execution Plan — The Vault Trading SaaS
**Date:** 2026-04-17 | **Analyst:** Claude Code (claude-sonnet-4-6)

---

## SECTION 1 — Executive Summary

The Vault is a functionally complete three-tier trading SaaS (super_admin → sub_admin → trader) built on Next.js 16 + Supabase. All three role dashboards are rendered and largely operational. The architecture is solid — RLS-first security, trigger-driven wallets, realtime via Supabase channels, and Binance WebSocket for live crypto prices.

**Codebase Health Score: 6.8 / 10**

- ✅ Role dashboards: All three roles have full UIs (~702, ~870, ~1143 lines respectively)
- ✅ RLS policies: Comprehensive, hierarchy-correct, sub-query isolation working
- ✅ Real-time data: Binance WS + 300ms batch throttle is correct; Supabase Realtime on key tables
- ✅ Financial workflow: Full deposit/withdrawal lifecycle with proof upload
- ❌ 2 critical runtime crashes waiting to happen (undefined function calls)
- ❌ 3 security violations (plaintext passwords, hardcoded backdoor email, unauthenticated API endpoint)
- ❌ 1 race condition on concurrent transaction approvals (double-credit risk)
- ❌ No AR/EN i18n system — Arabic text is hardcoded strings scattered throughout
- ❌ Duplicate Supabase client paths, dead proxy.ts, incomplete TypeScript types

---

## SECTION 2 — Detected Bugs & Broken Features

### P0 — CRITICAL (Will crash in production)

| # | File | Line | Bug | Fix |
|---|------|------|-----|-----|
| B1 | `src/app/sub-admin/[slug]/client/[id]/page.tsx` | ~427 | `syncData()` called but never defined — throws `ReferenceError` when sub-admin closes a trade | Rename call to `loadClientData()` (the function that actually exists) |
| B2 | `src/app/admin/page.tsx` | ~529 | `handleDeleteTenant(company.id)` called but function is named `handleDeleteCompany()` — delete button always throws | Rename call to `handleDeleteCompany(company.id)` |
| B3 | `src/app/api/db/route.ts` | entire file | Completely unauthenticated in-memory endpoint — exposes transaction/order state to any HTTP caller; data lost on server restart | Delete this file; it appears to be a dev scaffold never removed |

### P0 — SECURITY CRITICAL

| # | File | Issue | Fix |
|---|------|-------|-----|
| S1 | `src/app/api/create-trader/route.ts` + `update-client/route.ts` | `plain_password` column stores plaintext passwords in `profiles` table — OWASP / PCI-DSS violation | Remove `plain_password` column and all references; for the "admin can view initial password" use case, use a one-time token in user_metadata or send via email |
| S2 | `src/app/api/delete-tenant/route.ts` | Hardcoded email bypass: `if (user.email !== 'admin@thevault.io')` skips role check — any holder of that email gets god-mode delete | Remove the bypass; use only role check |
| S3 | `src/proxy.ts` | Dead file with the same backdoor bypass; never actually loaded by middleware | Delete file entirely |
| S4 | `.env.local` | Service role key is stored in `.env.local` — if this file is or was ever committed to git, the key must be rotated immediately | Add `.env.local` to `.gitignore`; create `.env.example` with placeholder values; rotate keys |

### P1 — HIGH (Logic errors causing wrong behavior)

| # | File | Issue |
|---|------|-------|
| L1 | `schema.sql` / `handle_transaction_approval()` trigger | Race condition: two concurrent admin approvals of the same transaction both pass, double-crediting the wallet. Needs `FOR UPDATE` row-level lock or a `CHECK (OLD.status = 'pending')` guard |
| L2 | `src/app/api/transactions/create/route.ts` | Withdrawal amount check has no row lock — two simultaneous withdrawals can both pass balance validation and overdraft. Needs DB-level lock or `execute_withdraw()` DB function with `FOR UPDATE` |
| L3 | `src/hooks/usePendingTransactions.ts` | Admin transactions hook has no sub_admin ownership filter — a sub_admin can see all pending transactions across all tenants (should filter by `assigned_to`) |
| L4 | `src/app/api/payment-settings/route.ts` | GET and POST are accessible by any authenticated user, not just sub_admin — a trader could read or overwrite payment gateway config |
| L5 | `schema.sql` | Notification INSERT RLS uses `WITH CHECK (true)` — any authenticated user can insert notifications, not just admins |

### P2 — MEDIUM

| # | File | Issue |
|---|------|-------|
| M1 | `src/hooks/useTransactions.ts` | Realtime channel name hardcoded as `'user-transactions'` — if two instances mount (e.g., admin impersonating), channels collide. Should include `userId` in channel name |
| M2 | `src/hooks/useNotifications.ts` | `userRole` parameter accepted but never used; `createClient()` called inside `useEffect` on every `userId` change instead of once |
| M3 | `src/lib/supabase/types.ts` | Only covers `profiles` and `wallets` — `transactions`, `payment_settings`, `notifications`, `trades` all lack TypeScript types, causing implicit `any` in API routes |
| M4 | Admin market access toggles | Handlers for market toggle buttons appear stubbed (empty function bodies) — toggling Crypto/Saudi/Forex access does nothing |
| M5 | `schema.sql` | `get_auth_role()` is defined 3 times across schema files — redundant, increases confusion, and will error on clean re-apply without `CREATE OR REPLACE` |

---

## SECTION 3 — Missing Features & Logic Gaps

### Sub-Admin CRM Gaps
- **No pagination** on the clients table — at scale (100+ traders), the table renders all rows, causing browser sluggishness
- **No search/filter** in the Sales & Leads tab
- **No CSV export** of client portfolio data (common CRM requirement)
- The `subscription renewal` modal exists but has no backend webhook or expiry-check cron to auto-suspend expired tenants

### Master Admin Gaps
- **Market access toggles** are stubbed — `toggleMarketAccess()` or equivalent handler is not implemented; the UI renders but writes nothing to DB
- **No global audit log** — no `audit_log` table; admin actions (delete tenant, approve transaction, close trade) leave no paper trail
- **No KYC table** or document review flow
- **Impersonation via localStorage** (`vault_impersonation_token`) — this is a security concern and also breaks on tab close

### Trader Dashboard Gaps
- **Arabic/English toggle is absent** — CLAUDE.md specifies bilingual support; no `next-i18next` or any i18n library is configured; Arabic strings are hardcoded in a few places and absent everywhere else
- **Saudi Indices** are listed in CLAUDE.md scope but the market watchlist only has crypto, commodities, and forex; Saudi indices (Tadawul symbols) are not present in `useMarketData.ts`
- **Candlestick chart uses mock OHLCV data** — the chart component generates random bars, not real history from an API; real trade history from `trades` table is also not plotted
- **Pending Orders tab** in trade history is always empty — no mechanism exists to create pending/limit orders; the tab is a placeholder

### Database / Schema Gaps
- No `audit_log` table for compliance
- No `kyc_documents` table
- No soft-delete (`deleted_at`) — user deletion permanently cascades and destroys trade/transaction history
- `notifications.user_role` is `TEXT` instead of the `user_role` ENUM — type mismatch
- `notifications.user_id` is nullable — should be NOT NULL
- Missing indexes: `profiles.email`, `subscription_payments.status`, `notifications.created_at`
- `execute_trade()` has 50+ symbols hardcoded in a 663-line CASE block — unmaintainable

---

## SECTION 4 — Proposed Tooling / Architecture Upgrades

| Area | Current | Proposed | Rationale |
|------|---------|----------|-----------|
| **i18n** | Hardcoded strings | `next-i18next` + `/public/locales/en` + `/ar` JSON files | Required for bilingual AR/EN spec |
| **Validation** | No runtime validation | `zod` (already in node_modules as indirect dep) — add explicit schema validation in all API routes | Prevents malformed input; type-safe |
| **Charts (OHLCV)** | Mock random data | Keep `lightweight-charts` but feed it real data from a free OHLCV API (e.g., Binance REST `/api/v3/klines`) | Real historical candles |
| **Saudi Indices** | Missing | Add Tadawul symbols via a Saudi market data provider (Mubasher, Argaam, or Refinitiv) or mock them similarly to commodities | Complete the spec |
| **DB Migrations** | Manual SQL files | Supabase CLI `supabase migrations` workflow | Version-controlled, reviewable, replayable |
| **Type Safety** | Partial `types.ts` | Run `supabase gen types typescript` to auto-generate all table types | Full type coverage, zero `any` |
| **Audit Log** | Missing | Add `audit_log` table + trigger pattern | Compliance, debugging |
| **Pagination** | None | Server-side pagination with `range()` in Supabase queries | Required for scale |
| **Remove** | `recharts` (unused) | Remove from `package.json` | ~500KB savings in bundle |
| **Remove** | `src/proxy.ts` | Delete | Dead code + security liability |

---

## SECTION 5 — Token-Optimized Action Plan (Step-by-Step Roadmap)

> Groups related files so each prompt fixes a coherent unit. Ordered by priority.

---

### STEP 1 — Emergency Bug Fixes (P0 Crashes)
**Files:** `src/app/sub-admin/[slug]/client/[id]/page.tsx`, `src/app/admin/page.tsx`, `src/app/api/db/route.ts`
- Fix `syncData()` → `loadClientData()` in client detail page
- Fix `handleDeleteTenant()` → `handleDeleteCompany()` in admin page
- Delete `src/app/api/db/route.ts` entirely

---

### STEP 2 — Security Hardening (P0 Security)
**Files:** `src/app/api/delete-tenant/route.ts`, `src/proxy.ts`, `src/app/api/create-trader/route.ts`, `src/app/api/update-client/route.ts`, `schema.sql`/`migration_v2.sql`
- Remove backdoor email bypass from `delete-tenant`
- Delete `src/proxy.ts`
- Remove `plain_password` from create-trader and update-client routes
- Add migration to drop `plain_password` column from profiles
- Fix notification INSERT RLS policy to admin-only

---

### STEP 3 — Race Condition & Auth Fixes
**Files:** `schema.sql` (trigger), `src/app/api/transactions/create/route.ts`, `src/hooks/usePendingTransactions.ts`, `src/app/api/payment-settings/route.ts`
- Add `FOR UPDATE` lock in `handle_transaction_approval()` trigger
- Add DB-level withdrawal lock in create transaction route
- Add sub_admin ownership filter to `usePendingTransactions`
- Restrict `payment-settings` POST to sub_admin role

---

### STEP 4 — TypeScript Type Completion + Supabase Client Consolidation
**Files:** `src/lib/supabase/types.ts`, `src/utils/supabase/` (delete), all pages that import from `@/utils/supabase`
- Generate full types from Supabase (or manually write) for all 7 tables
- Delete `src/utils/supabase/` directory
- Update all imports to `@/lib/supabase/client` and `@/lib/supabase/server`

---

### STEP 5 — Admin Market Access + Missing Functionality
**Files:** `src/app/admin/page.tsx`
- Implement `toggleMarketAccess()` handler — write market access flags to `profiles` or a new `market_access` column
- Add pagination to tenant/company table

---

### STEP 6 — Sub-Admin CRM Enhancements
**Files:** `src/app/sub-admin/[slug]/page.tsx`
- Add pagination to clients table (Supabase `range()`)
- Add search/filter bar to Sales & Leads tab
- Fix `usePendingTransactions` channel name (include userId)

---

### STEP 7 — Trader Dashboard: Real Charts + Saudi Indices
**Files:** `src/components/CandlestickChart.tsx`, `src/hooks/useMarketData.ts`
- Replace mock OHLCV generator with Binance REST `/api/v3/klines` fetch
- Add Tadawul/Saudi indices symbols to `useMarketData` (mock or live)
- Fix `useTransactions` channel name collision

---

### STEP 8 — i18n Bilingual AR/EN
**Files:** New `/public/locales/en/common.json`, `/public/locales/ar/common.json`, `src/app/layout.tsx`, all pages
- Install and configure `next-i18next`
- Extract all hardcoded strings from user, sub-admin, and admin pages into translation keys
- Add language toggle button to trader dashboard header

---

### STEP 9 — Database Schema Cleanup Migration
**Files:** New `migration_v3.sql`
- Add missing indexes
- Fix `notifications.user_role` to use ENUM
- Add `NOT NULL` to `notifications.user_id`
- Consolidate duplicate `get_auth_role()` definitions
- Add `audit_log` table with triggers
- Add `deleted_at` soft-delete column to profiles/trades

---

### STEP 10 — Dependency Cleanup + Types Generation
**Files:** `package.json`
- Remove unused `recharts`
- Add `zod` explicitly
- Run `supabase gen types typescript --project-id <id>` to auto-generate types going forward

---

## Verification Approach

After each step:
1. `npm run build` — confirms no TypeScript/import errors
2. `npm run lint` — confirms ESLint clean
3. Manual UI test of the affected role's dashboard (dev server `npm run dev`)
4. For DB changes: apply migration via Supabase MCP `apply_migration` and verify with `execute_sql`
5. For security fixes: attempt the exploit path (e.g., call `DELETE /api/delete-tenant` as non-admin) to confirm it's blocked

---

## Critical Files Reference

| File | Role |
|------|------|
| `src/app/admin/page.tsx` | Super Admin UI (~702 lines) |
| `src/app/user/page.tsx` | Trader UI (~1143 lines) |
| `src/app/sub-admin/[slug]/page.tsx` | Sub-Admin CRM (~870 lines) |
| `src/app/sub-admin/[slug]/client/[id]/page.tsx` | Client detail view (~650 lines) |
| `src/app/api/transactions/create/route.ts` | Deposit/withdrawal creation |
| `src/app/api/transactions/review/route.ts` | Admin approval |
| `src/app/api/create-trader/route.ts` | Trader provisioning |
| `src/app/api/delete-tenant/route.ts` | Tenant deletion (has backdoor) |
| `src/hooks/useMarketData.ts` | Binance WS + simulated prices |
| `src/hooks/usePendingTransactions.ts` | Admin financial hook |
| `src/lib/supabase/types.ts` | Incomplete DB types |
| `schema.sql` | Primary DB schema |
| `migration_v2.sql` | Adds quantity, close_trade(), plain_password |
