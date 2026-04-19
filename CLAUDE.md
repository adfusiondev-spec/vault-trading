# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev       # Start development server
npm run build     # Production build
npm run start     # Production server
npm run lint      # Run ESLint
```

No test runner is configured.

## Architecture Overview

This is a **multi-role fintech trading platform** built on Next.js App Router + Supabase. Three user roles drive nearly every architectural decision:

- **super_admin** — manages all users, payment gateways, transactions
- **sub_admin** — manages an assigned subset of traders (multi-tenant CRM)
- **trader** — self-service dashboard (wallet, trades, deposits/withdrawals)

### Route Structure

```
/                      → redirects to /user
/login, /register      → public auth pages
/admin                 → Super Admin dashboard (src/app/admin/page.tsx, ~734 lines)
/sub-admin             → Sub-Admin portal entry
/sub-admin/[slug]      → Sub-Admin CRM for assigned traders
/sub-admin/[slug]/client/[id]  → Individual trader detail view
/user                  → Trader dashboard (src/app/user/page.tsx, ~1142 lines)
/api/*                 → Server-side API routes
```

### Middleware & Auth

`src/middleware.ts` handles session refresh and enforces role-based route protection — super_admin routes are locked to that role, sub_admin to theirs, etc. Supabase Auth (email/password) provides the session; cookies carry it server-side.

### Data Layer

**Supabase** is the only backend. Two client flavors:
- `src/lib/supabase/server.ts` — server components and API routes
- `src/lib/supabase/client.ts` — browser-side (hooks, client components)

**Row-Level Security is the primary access-control enforcement layer** — not just the frontend. Every table has RLS policies that mirror the role hierarchy. Admin operations that need to bypass RLS use the service role key (server-only, never exposed to the client).

### Database Key Tables

| Table | Purpose |
|---|---|
| `profiles` | Extends `auth.users`; holds `role` enum and `assigned_to` FK for sub_admin→trader relationship |
| `wallets` | Auto-created by trigger on profile insert; one USD wallet per user |
| `trades` | Open/closed positions; `execute_trade()` DB function handles atomic execution + wallet debit |
| `transactions` | Deposits & withdrawals; approval triggers `handle_transaction_approval()` to credit/debit wallet |
| `payment_gateways` | Configurable gateways (bank transfer, BTC, USDT) with JSONB config |
| `notifications` | Realtime-enabled; used for cross-role alerts |
| `subscription_payments` | Sub-admin fee tracking |

Schema lives in `schema.sql`. Migrations in `migration-4-2.sql` and `migration_v2.sql`.

### Real-Time Data

- **Market data** (`src/hooks/useMarketData.ts`): Binance WebSocket for 8 crypto pairs; simulated prices for 50+ commodities, forex pairs, and indices. Updates are batched at 300ms to prevent render storms.
- **Notifications** (`src/hooks/useNotifications.ts`): Supabase Realtime channel subscriptions.

### API Routes

All under `src/app/api/`. Key ones:
- `create-trader` / `create-tenant` / `delete-tenant` — user provisioning
- `transactions/create` + `transactions/review` — deposit/withdrawal lifecycle
- `payment-settings` — gateway CRUD (super_admin only)
- `update-client` — profile edits by sub_admin/super_admin

### Path Alias

`@/*` resolves to `./src/*` (configured in `tsconfig.json`).
