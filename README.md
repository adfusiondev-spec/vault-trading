# The Vault — Multi-Tenant Cloud Trading SaaS & CRM

Professional dark-mode trading platform with three-tier role architecture built on Next.js + Supabase.

## Features

- **Super Admin** — Global SaaS control: tenant management, payment gateways, subscription packages
- **Sub-Admin (Tenant)** — CRM portal: client management, live trade monitoring, financial desk
- **Trader (Client)** — Real-time dashboard: crypto/forex/commodities trading, deposits, withdrawals

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.2 (App Router) |
| Language | TypeScript |
| Database | Supabase (PostgreSQL + Auth + Realtime) |
| Charting | TradingView lightweight-charts |
| Market Data | Binance WebSocket (live crypto) + simulated prices |
| Theme | Dark mode — Black & Gold (`#FFD700`) |

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Fill in your Supabase URL, anon key, and service role key

# 3. Run database migrations (Supabase SQL Editor)
#    Execute in order: schema.sql → migration-4-2.sql → migration_v2.sql

# 4. Start dev server
npm run dev
```

Visit `http://localhost:3000` — redirects to `/login`.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (server-only, bypasses RLS) |
| `NEXT_PUBLIC_APP_URL` | No | App base URL (default: `http://localhost:3000`) |

## Project Structure

```
src/
  app/
    admin/              # Super Admin dashboard
    sub-admin/[slug]/   # Sub-Admin CRM portal
      client/[id]/      # Individual trader view
    user/               # Trader dashboard
    api/                # Server-side API routes
    login/ register/    # Auth pages
  components/           # Shared UI components
  hooks/                # useMarketData, useNotifications, etc.
  lib/
    supabase/           # client.ts + server.ts
    i18n/               # Translations (EN/AR)
```

## Role Architecture

```
super_admin
  └── manages sub_admins (tenants)
        └── each sub_admin manages their traders
              └── traders access /user dashboard
```

Access control is enforced at two layers:
1. **Middleware** (`middleware.ts`) — route-level role checks
2. **Row-Level Security** — Supabase RLS policies on every table

## Commands

```bash
npm run dev      # Development server (http://localhost:3000)
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
```

## Database Key Tables

| Table | Purpose |
|---|---|
| `profiles` | Extends `auth.users`; holds role + `assigned_to` FK |
| `wallets` | One USD wallet per user, auto-created on signup |
| `trades` | Open/closed positions; atomic execution via `execute_trade()` |
| `transactions` | Deposits & withdrawals with approval workflow |
| `payment_gateways` | Configurable gateways (bank, BTC, USDT) per tenant |
| `subscription_payments` | Sub-admin fee tracking with package/trial support |
| `notifications` | Realtime cross-role alerts |

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project at vercel.com/new
3. Add environment variables in Vercel dashboard (see table above)
4. Deploy — Vercel auto-detects Next.js, no extra config needed

### Environment Variables for Production

| Variable | Environment |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | **Production only** — never expose in preview/client |
| `NEXT_PUBLIC_APP_URL` | Production (set to your Vercel URL) |

### Supabase Production Checklist

- Enable Realtime on: `trades`, `transactions`, `wallets`, `notifications`, `subscription_payments`
- Verify RLS is active on all tables
- Create `payment-proofs` storage bucket (private, 5MB limit, image/* + PDF)
- Set Auth Site URL to your Vercel deployment URL
- Add `/auth/callback` to allowed redirect URLs

## Architecture

- **Three-Layer Role System** — `super_admin` → `sub_admin` → `trader`
- **Multi-Tenancy** — RLS policies enforce data isolation per tenant
- **Real-Time** — Supabase Realtime channels for live trade/notification updates
- **Market Data** — Binance WebSocket (live crypto) + simulated prices for commodities/forex/indices

## Security

- Row Level Security (RLS) on all tables — primary access control layer
- Server-side auth enforcement via Next.js middleware
- `SUPABASE_SERVICE_ROLE_KEY` used only in API routes, never client-side
- Cookie-based sessions (SSR compatible via `@supabase/ssr`)

## License

MIT
