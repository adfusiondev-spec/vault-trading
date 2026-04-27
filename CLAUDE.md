# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Platform

**Official brand / platform name: NOKHBA**
Repository folder: `Vault_Trading` (legacy name — always refer to the product as NOKHBA in UI copy and documentation).

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.4 (App Router) |
| Language | TypeScript 5 |
| UI | React 19 |
| Styling | Tailwind CSS 4 |
| Database / Auth | Supabase (PostgreSQL + RLS + Realtime) |
| Charts | lightweight-charts 5, Recharts 3 |
| Animation | Framer Motion 12 |
| i18n | Custom (src/lib/i18n/ — en/ar) |

## Commands

```bash
npm run dev         # Start development server
npm run build       # Production build (--webpack flag enforced)
npm run start       # Production server
npm run lint        # Run ESLint
npm run type-check  # TypeScript type check (tsc --noEmit)
```

No test runner is configured.

## Architecture Overview

NOKHBA is a **multi-role fintech trading platform** built on Next.js App Router + Supabase. Four user roles drive nearly every architectural decision:

- **super_admin** — manages all users, payment gateways, transactions
- **sub_admin** — manages an assigned subset of traders (multi-tenant CRM); has a `company_slug` and `invite_token`
- **sales** — sub_admin-created staff who manage leads within the sub_admin's tenant
- **trader** — self-service dashboard (wallet, trades, deposits/withdrawals)

### Route Structure

```
/                                   → redirects to /user
/login, /register                   → public auth pages
/reset-password                     → password reset page
/admin                              → Super Admin dashboard
/admin/profile                      → Super Admin profile settings
/sub-admin                          → Sub-Admin portal entry
/sub-admin/[slug]                   → Sub-Admin CRM for assigned traders
/sub-admin/[slug]/auth              → Sub-Admin authentication gate
/sub-admin/[slug]/client/[id]       → Individual trader detail view
/sub-admin/[slug]/profile           → Sub-Admin profile settings
/sub-admin/[slug]/sales             → Sales team management & leads CRM
/user                               → Trader dashboard
/api/*                              → Server-side API routes
```

### Middleware & Auth

`middleware.ts` (project root, **not** `src/`) handles session refresh and enforces role-based route protection. Always use `supabase.auth.getUser()` — never `getSession()` — in middleware and server code. Supabase Auth (email/password) provides the session; cookies carry it server-side.

### Data Layer

**Supabase** is the only backend. Two client flavors:
- `src/lib/supabase/server.ts` — server components and API routes (uses anon key + RLS)
- `src/lib/supabase/client.ts` — browser-side (hooks, client components)
- `src/lib/supabase/types.ts` — shared TypeScript types (`Profile`, `Wallet`, `Database`); imported by both client flavors
- Service-role client (`createClient` from `@supabase/supabase-js` with `SUPABASE_SERVICE_ROLE_KEY`) — created inline in API routes that need to bypass RLS (user provisioning, invite registration, subscription payments). Never expose the service role key to the browser.

**Row-Level Security is the primary access-control enforcement layer** — not just the frontend. Every table has RLS policies that mirror the role hierarchy.

### Database Key Tables

| Table | Purpose |
|---|---|
| `profiles` | Extends `auth.users`; holds `role` enum, `assigned_to` FK (sub_admin→trader), `company_slug`, `invite_token`, `subscription_package`, `expires_at` |
| `wallets` | Auto-created by trigger on profile insert; one USD wallet per user |
| `trades` | Open/closed positions; `execute_trade()` DB function handles atomic execution + wallet debit |
| `transactions` | Deposits & withdrawals; approval triggers `handle_transaction_approval()` to credit/debit wallet |
| `payment_gateways` | Configurable gateways (bank transfer, BTC, USDT) with JSONB config |
| `notifications` | Realtime-enabled; used for cross-role alerts |
| `subscription_payments` | Sub-admin fee tracking; must be inserted via service-role client (RLS bypass required — `auth.uid()` mismatch when super_admin triggers insert) |
| `leads` | CRM leads owned by sub_admin, optionally assigned to a `sales` user; statuses: New Prospect, Active, Hot Lead, Cold, Prospect, Inactive, Contacted, In Negotiation, Active / Funded |

Schema lives in `schema.sql`. Migrations: `migration_v2.sql`, `migration_v3.sql`, `migration-4-2.sql`. Additional DB setup: `storage_setup.sql`, `fix_rls.sql`, `update_transaction_trigger.sql`.

### Real-Time Data

- **Market data** (`src/hooks/useMarketData.ts`): Binance WebSocket for 8 crypto pairs; simulated prices for 50+ commodities, forex pairs, and indices. Updates are batched at 300ms to prevent render storms.
- **Notifications** (`src/hooks/useNotifications.ts`): Supabase Realtime channel subscriptions.

### Subscription & Trial

Sub-admins have a `subscription_package` (`Trial_1day`, `Standard`, `VIP`) and `expires_at`. Trial enforcement helpers live in `src/lib/trial.ts` (`isTrialExpired`, `isTrialActive`). Subscription pricing is calculated in `src/lib/pricing.ts` — base $300/mo with add-ons for global indices (+$100) and Saudi markets (+$300), capped at $700.

### Invite Flow

Traders register via `/register?token=<invite_token>` which hits `api/register-via-invite`. The token resolves the owning sub_admin; the API uses the service-role client to create the auth user and link the profile in one request (email confirmation is skipped — the invite is admin-trusted).

### API Routes

All under `src/app/api/`. Key ones:
- `create-trader` / `create-tenant` / `delete-tenant` — user provisioning (service-role)
- `create-sales` — creates a `sales` role user under a sub_admin
- `register-via-invite` — invite-token-based trader self-registration (service-role)
- `transactions/create` + `transactions/review` — deposit/withdrawal lifecycle
- `payment-settings/admin` + `payment-settings/user` — gateway CRUD
- `payment-settings` — base payment settings route
- `sub-admin-payment-settings` — sub_admin-scoped gateway config
- `leads` + `leads/convert` + `leads/import` — CRM lead management; `convert` promotes a lead to a trader account
- `update-client` — profile edits by sub_admin/super_admin
- `trader-markets` — controls which market categories a trader can access
- `subscription-payment` — records sub_admin subscription payments (service-role required)
- `decrypt-password` — utility for decrypting stored encrypted passwords
- `db` — internal database utility route

### Shared Components

| Component | Location | Usage |
|---|---|---|
| `CandlestickChart` | `src/components/CandlestickChart.tsx` | Dynamic import (no SSR); trading chart view |
| `LanguageToggle` | `src/components/LanguageToggle.tsx` | AR/EN switcher |
| `PasswordField` | `src/components/PasswordField.tsx` | Reusable password input with visibility toggle |
| `FinancialDesk` | `src/components/admin/FinancialDesk.tsx` | Super admin financial operations panel |
| `PackageSettings` | `src/components/admin/PackageSettings.tsx` | Subscription package management UI |
| `PaymentSettingsPanel` (admin) | `src/components/admin/PaymentSettingsPanel.tsx` | Admin-scoped gateway settings |
| `PaymentSettingsPanel` (sub-admin) | `src/components/sub-admin/PaymentSettingsPanel.tsx` | Sub-admin-scoped gateway settings |

### Hooks

| Hook | Purpose |
|---|---|
| `useMarketData` | Real-time market prices (Binance WS + simulated) |
| `useNotifications` | Supabase Realtime notification subscription |
| `usePendingTransactions` | Fetches pending deposits/withdrawals for sub_admin |
| `useTransactions` | Fetches transaction history for trader |

### Utilities

| File | Purpose |
|---|---|
| `src/lib/crypto.ts` | Encrypt/decrypt passwords for storage |
| `src/lib/trial.ts` | `isTrialExpired`, `isTrialActive` helpers |
| `src/lib/pricing.ts` | Subscription cost calculator |
| `src/lib/i18n/` | AR/EN translation strings + `useTranslation` hook |

### Path Alias

`@/*` resolves to `./src/*` (configured in `tsconfig.json`).
