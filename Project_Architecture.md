# Project Architecture — The Vault Trading Platform

> A multi-tenant cloud trading SaaS & CRM built on Next.js 16 App Router + Supabase.
> Three distinct user roles drive every architectural decision.

---

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Framework | Next.js (App Router) | 16.2.2 |
| UI Library | React | 19.2.4 |
| Styling | Tailwind CSS v4 + Inline Styles | 4.x |
| Database & Auth | Supabase (PostgreSQL + Auth) | 2.101.1 |
| Charting | lightweight-charts (TradingView) | 5.1.0 |
| Icons | lucide-react | 1.7.0 |
| Animations | framer-motion | 12.38.0 |
| Language | TypeScript | 5.x |
| Design Theme | Dark Mode — Black & Gold (#FFD700) | — |

---

## The Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  LAYER 1: MASTER ADMIN                  │
│                     /admin                              │
│         (SaaS Owner — Full System Control)              │
└─────────────────────────┬───────────────────────────────┘
                          │ creates & manages
┌─────────────────────────▼───────────────────────────────┐
│                LAYER 2: SUB-ADMIN (TENANT)              │
│               /sub-admin/[slug]                         │
│        (Brokerage Company — CRM & Risk Mgmt)            │
└─────────────────────────┬───────────────────────────────┘
                          │ creates & manages
┌─────────────────────────▼───────────────────────────────┐
│                  LAYER 3: TRADER                        │
│                    /user                                │
│          (Investor — Trading Dashboard)                 │
└─────────────────────────────────────────────────────────┘
```

---

## Layer 1 — Master Admin (`super_admin`)

**Route:** `/admin` → `src/app/admin/page.tsx`

**Role:** The SaaS platform owner. Has unrestricted access to all data across all tenants.

### Capabilities

| Feature | Description |
|---------|-------------|
| **Tenant Management** | Create, edit, delete, and impersonate sub-admin accounts |
| **Subscription Control** | Set subscription tiers (Trial, Standard, VIP), approve/reject renewal payments |
| **Market Access Control** | Toggle which asset classes each sub-admin can offer traders (Crypto, Forex, Saudi Indices, Commodities) |
| **Global Payment Settings** | Configure system-wide USDT, BTC, and Bank Transfer gateways via `payment_gateways` table |
| **Financial Desk** | Review and approve all subscription payments from sub-admins (`subscription_payments` table) |
| **Global Statistics** | System volume, active tenants, total clients, system integrity metrics |
| **Notifications** | Real-time alerts across all system events |
| **Impersonation** | Can simulate a sub-admin session to inspect their tenant environment |

### UI Structure
- **5-tab Sidebar:** Dashboard · Tenants · Financial Desk · Payment Settings · Notifications
- Summary cards (system volume, active tenants, total clients, system integrity)
- Tenant table (8 columns) with Add/Edit modal and delete actions
- Subscription payment approval table

---

## Layer 2 — Sub-Admin / Tenant (`sub_admin`)

**Route:** `/sub-admin/[slug]` → `src/app/sub-admin/[slug]/page.tsx`
**Client Detail:** `/sub-admin/[slug]/client/[id]` → `src/app/sub-admin/[slug]/client/[id]/page.tsx`

**Role:** A brokerage company licensed on the platform. Manages their own pool of traders. Identified by a unique `company_slug` in the URL.

### Capabilities

| Feature | Description |
|---------|-------------|
| **Live Trade Monitor** | Real-time view of all open positions across all assigned traders; emergency close button per trade |
| **Client CRM** | Spreadsheet-style portfolio table with 10 columns (name, balance, trades, P&L, status, etc.) |
| **Financial Desk** | Approve or reject trader deposit/withdrawal requests (`transactions` table) |
| **Client Registration** | Create new trader accounts assigned to this sub-admin |
| **Password Management** | Reset trader passwords via the client detail view |
| **Subscription Renewal** | Submit subscription payments to the master admin |
| **Notifications** | Real-time alerts for new deposits, withdrawals, and trade activity |

### Multi-Tenancy Isolation
- Sub-admins can only see traders where `profiles.assigned_to = sub_admin.id`
- All data isolation is enforced at the database level via RLS policies
- Each sub-admin accesses the platform via their unique slug URL: `/sub-admin/[company-slug]`

### UI Structure
- **3-tab Sidebar:** Trade Monitor · Sales & Leads · Financial Desk
- Summary cards (Total Clients, Active Trades, Pending Financials)
- Trade monitor table with emergency close actions
- Client portfolio table (Excel-style)
- Financial requests table with approve/reject actions

---

## Layer 3 — Trader (`trader`)

**Route:** `/user` → `src/app/user/page.tsx`

**Role:** An investor/client registered under a specific brokerage (sub-admin). Accesses the platform through a link provided by their broker.

### Capabilities

| Feature | Description |
|---------|-------------|
| **Live Candlestick Chart** | TradingView-style chart via `lightweight-charts` with volume histogram |
| **Market Watchlist** | 40+ instruments: crypto, commodities, global indices, Saudi indices, forex |
| **Trade Execution** | BUY/SELL with real-time prices; calls `execute_trade()` DB function atomically |
| **Open Positions** | Live P&L tracking on all open trades |
| **Pending Orders** | Placeholder tab (limit orders not yet implemented) |
| **Trade History** | Closed positions with P&L breakdown |
| **Transaction Statements** | Full deposit/withdrawal history |
| **Account Summary** | Balance, equity, margin, free margin display |
| **Deposit / Withdrawal** | Multi-method: USDT TRC20, BTC, Bank Transfer; receipt upload |
| **Profile Settings** | Name, phone, country, password change |
| **Real-time Balance** | Updates via Supabase Realtime on `wallets` and `transactions` tables |

### UI Layout (3-Column)
```
┌──────────────┬───────────────────────────┬─────────────────┐
│   Watchlist  │  Candlestick Chart        │  Account Panel  │
│  (Left ~20%) │  + Trade Execution Bar    │  (Right ~25%)   │
│              │  (Center ~55%)            │                 │
└──────────────┴───────────────────────────┴─────────────────┘
                      ↓
          [ Open | Pending | Closed | Statements | Summary ]
                  Trade History Tabs
```

---

## Authentication & Routing

### Auth Provider
Supabase Auth (email/password). Sessions are cookie-based for SSR compatibility.

### Middleware (`src/middleware.ts`)
Every request through protected routes passes through middleware which:
1. Refreshes the session cookie
2. Reads `profiles.role` from Supabase
3. Enforces role-based routing:

| Path | Allowed Role | Redirect if Wrong Role |
|------|-------------|----------------------|
| `/admin/*` | `super_admin` | → `/login` or role-specific dashboard |
| `/sub-admin/*` | `sub_admin` | → `/login` or role-specific dashboard |
| `/user/*` | `trader` | → `/login` or role-specific dashboard |
| `/login` | unauthenticated | authenticated users → their dashboard |

---

## Data Layer

### Supabase Client Flavors

| File | Used In | Purpose |
|------|---------|---------|
| `src/lib/supabase/server.ts` | API routes, Server Components | Cookie-aware server-side client |
| `src/lib/supabase/client.ts` | Hooks, Client Components | Browser-side client |
| `src/utils/supabase/server.ts` | Some API routes (inconsistency) | Duplicate — should be consolidated |
| `src/utils/supabase/client.ts` | Some components (inconsistency) | Duplicate — should be consolidated |

### Access Control Strategy
**RLS is the primary enforcement layer** — not the frontend. Every table has RLS policies mirroring the role hierarchy. Frontend role checks are secondary guards only. Admin operations that bypass RLS use the service role key (server-side only, via `SUPABASE_SERVICE_ROLE_KEY`).

---

## Real-Time Data

### Market Prices (`src/hooks/useMarketData.ts`)
- **Crypto (8 pairs):** Live prices via Binance WebSocket `wss://stream.binance.com`
- **Commodities, Forex, Indices (50+ symbols):** Simulated prices with random walk updates every 2 seconds
- **Throttle:** Price updates batched at 300ms intervals to prevent render storms
- **Auto-reconnect:** WebSocket retries every 3 seconds on disconnect

### Financial Data (Supabase Realtime)
| Hook | Channel | Event | Scope |
|------|---------|-------|-------|
| `useTransactions` | `user-transactions` | UPDATE | Filtered by `user_id` |
| `usePendingTransactions` | `admin-transactions` | ALL | All pending transactions (admin) |
| `useNotifications` | dynamic | INSERT | Filtered by `user_id` |

---

## Route Structure

```
/                           → redirects to /user
/login                      → public (Supabase Auth form)
/register                   → public (trader self-register via broker link)
/admin                      → Super Admin dashboard
/sub-admin                  → redirects to /sub-admin/[slug]
/sub-admin/[slug]           → Sub-Admin CRM dashboard
/sub-admin/[slug]/client/[id] → Individual trader detail view
/user                       → Trader dashboard
/api/create-tenant          → POST — provision sub-admin (super_admin only)
/api/create-trader          → POST — provision trader (sub_admin / super_admin)
/api/delete-tenant          → POST — delete sub-admin account (super_admin only)
/api/update-client          → POST — edit trader profile/password/ban (admin only)
/api/transactions/create    → POST — create deposit/withdrawal request (trader)
/api/transactions/review    → POST — approve/reject transaction (admin)
/api/payment-settings       → GET/POST — sub-admin payment config
/api/payment-settings/user  → GET — trader fetches their broker's payment config
/api/db                     → GET/POST — ⚠ unauthenticated dev scaffold (should be deleted)
```

---

## Component Structure

```
src/
├── app/
│   ├── admin/page.tsx              ← Super Admin (702 lines)
│   ├── user/page.tsx               ← Trader dashboard (1143 lines)
│   ├── sub-admin/
│   │   ├── page.tsx                ← Redirect stub
│   │   └── [slug]/
│   │       ├── page.tsx            ← Sub-Admin CRM (870 lines)
│   │       └── client/[id]/page.tsx ← Client detail (650 lines)
│   ├── login/page.tsx
│   ├── register/page.tsx
│   └── api/                        ← All API routes (server-side)
├── components/
│   ├── CandlestickChart.tsx        ← TradingView candlestick chart
│   └── admin/
│       ├── PaymentSettingsPanel.tsx
│       └── FinancialDesk.tsx
├── hooks/
│   ├── useMarketData.ts            ← Binance WS + simulated prices
│   ├── useTransactions.ts          ← Wallet & transaction state
│   ├── useNotifications.ts         ← Real-time notification feed
│   └── usePendingTransactions.ts   ← Admin financial review hook
├── lib/supabase/
│   ├── client.ts                   ← Browser Supabase client
│   ├── server.ts                   ← SSR Supabase client
│   └── types.ts                    ← DB type definitions (partial)
└── middleware.ts                   ← Auth + role-based routing
```

---

## Security Architecture

| Mechanism | Description |
|-----------|-------------|
| **Supabase Auth** | Email/password authentication; JWT tokens in cookies |
| **Row Level Security** | Primary data isolation layer — enforced at DB level |
| **Service Role Key** | Used only server-side in API routes for admin operations |
| **Role Middleware** | Next.js middleware enforces route-level role checks |
| **Assignment FK** | `profiles.assigned_to` is the multi-tenancy FK — RLS policies reference it for all sub-query isolation |

---

## Known Architecture Issues (for reference)

| Issue | Severity | Location |
|-------|----------|----------|
| `syncData()` undefined — runtime crash | Critical | `sub-admin/[slug]/client/[id]/page.tsx:427` |
| `handleDeleteTenant()` undefined — runtime crash | Critical | `admin/page.tsx:529` |
| Unauthenticated `/api/db` endpoint | Critical | `api/db/route.ts` |
| `plain_password` stored in plaintext | Security | `profiles` table, `create-trader`, `update-client` |
| Hardcoded backdoor email in delete-tenant | Security | `api/delete-tenant/route.ts:15` |
| Race condition on concurrent transaction approvals | High | `handle_transaction_approval()` trigger |
| Duplicate Supabase client paths | Medium | `src/lib/` vs `src/utils/` |
| No AR/EN i18n system | High | All pages |
