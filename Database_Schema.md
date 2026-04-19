# Database Schema — The Vault Trading Platform

> Source files: `schema.sql`, `migration-4-2.sql`, `migration_v2.sql`
> Database: Supabase PostgreSQL with Row Level Security (RLS) enforced on all tables.

---

## Extensions

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

---

## ENUM Types

```sql
CREATE TYPE user_role          AS ENUM ('super_admin', 'sub_admin', 'trader');
CREATE TYPE trade_status       AS ENUM ('open', 'closed', 'cancelled');
CREATE TYPE transaction_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE transaction_type   AS ENUM ('deposit', 'withdrawal');
CREATE TYPE trade_type         AS ENUM ('buy', 'sell');
```

---

## Tables

### `profiles`
Extends `auth.users`. Holds role, assignment hierarchy, and optional CRM fields.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID PK | → `auth.users(id)` ON DELETE CASCADE |
| `email` | TEXT | UNIQUE NOT NULL |
| `full_name` | TEXT | NOT NULL |
| `phone_number` | TEXT | nullable |
| `country` | TEXT | nullable |
| `notes` | TEXT | nullable |
| `role` | `user_role` | NOT NULL DEFAULT `'trader'` |
| `assigned_to` | UUID | → `profiles(id)` ON DELETE SET NULL |
| `company_slug` | TEXT | nullable (added migration-4-2) |
| `subscription_package` | TEXT | DEFAULT `'Standard'` (added migration-4-2) |
| `plain_password` | TEXT | nullable (added migration_v2 — ⚠ security concern) |
| `is_banned` | BOOLEAN | DEFAULT false (added migration_v2) |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() |

**Constraints:**
- `CONSTRAINT no_self_assignment CHECK (id != assigned_to)`
- `CONSTRAINT super_admin_no_assignment CHECK (role != 'super_admin' OR assigned_to IS NULL)`

**Indexes:**
```sql
CREATE INDEX idx_profiles_assigned_to ON profiles(assigned_to);
CREATE INDEX idx_profiles_role        ON profiles(role);
```

---

### `wallets`
One USD wallet per user, auto-created by trigger on profile insert.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID PK | DEFAULT `uuid_generate_v4()` |
| `user_id` | UUID | NOT NULL → `profiles(id)` ON DELETE CASCADE |
| `balance` | DECIMAL(20,8) | NOT NULL DEFAULT 0, CHECK `balance >= 0` |
| `currency` | TEXT | NOT NULL DEFAULT `'USD'` |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() |

**Constraints:**
- `CONSTRAINT unique_user_currency UNIQUE(user_id, currency)`

**Indexes:**
```sql
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
```

---

### `trades`
Open and closed trading positions. Executed atomically via `execute_trade()`.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID PK | DEFAULT `uuid_generate_v4()` |
| `user_id` | UUID | NOT NULL → `profiles(id)` ON DELETE CASCADE |
| `symbol` | TEXT | NOT NULL |
| `type` | `trade_type` | NOT NULL (`buy` / `sell`) |
| `amount` | DECIMAL(20,8) | NOT NULL CHECK `> 0` |
| `entry_price` | DECIMAL(20,8) | NOT NULL CHECK `> 0` |
| `exit_price` | DECIMAL(20,8) | nullable |
| `quantity` | DECIMAL(20,8) | nullable (added migration_v2; backfilled as `amount / entry_price`) |
| `status` | `trade_status` | NOT NULL DEFAULT `'open'` |
| `profit_loss` | DECIMAL(20,8) | nullable |
| `notes` | TEXT | nullable |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `closed_at` | TIMESTAMPTZ | nullable |

**Indexes:**
```sql
CREATE INDEX idx_trades_user_id    ON trades(user_id);
CREATE INDEX idx_trades_status     ON trades(status);
CREATE INDEX idx_trades_created_at ON trades(created_at DESC);
```

**Realtime:** Enabled via `ALTER PUBLICATION supabase_realtime ADD TABLE trades`

---

### `transactions`
Deposit and withdrawal requests with full audit trail.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID PK | DEFAULT `uuid_generate_v4()` |
| `user_id` | UUID | NOT NULL → `profiles(id)` ON DELETE CASCADE |
| `type` | `transaction_type` | NOT NULL (`deposit` / `withdrawal`) |
| `amount` | DECIMAL(20,8) | NOT NULL CHECK `> 0` |
| `currency` | TEXT | NOT NULL DEFAULT `'USD'` |
| `status` | `transaction_status` | NOT NULL DEFAULT `'pending'` |
| `payment_method` | TEXT | nullable (e.g., `bank_transfer`, `crypto`) |
| `payment_details` | JSONB | nullable (account details, wallet address, etc.) |
| `admin_notes` | TEXT | nullable |
| `proof_of_payment_url` | TEXT | nullable (path in `payment-proofs` storage bucket) |
| `destination_address` | TEXT | nullable (for withdrawals) |
| `processed_by` | UUID | → `profiles(id)` ON DELETE SET NULL |
| `processed_at` | TIMESTAMPTZ | nullable |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() |

**Indexes:**
```sql
CREATE INDEX idx_transactions_user_id    ON transactions(user_id);
CREATE INDEX idx_transactions_status     ON transactions(status);
CREATE INDEX idx_transactions_type       ON transactions(type);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
```

**Realtime:** Enabled via `ALTER PUBLICATION supabase_realtime ADD TABLE transactions`

---

### `payment_gateways`
Global payment method configuration managed by super_admin.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID PK | DEFAULT `uuid_generate_v4()` |
| `name` | TEXT | NOT NULL UNIQUE |
| `display_name` | TEXT | NOT NULL |
| `type` | TEXT | NOT NULL (`fiat` / `crypto`) |
| `is_active` | BOOLEAN | NOT NULL DEFAULT true |
| `config` | JSONB | NOT NULL DEFAULT `{}` |
| `supported_currencies` | TEXT[] | NOT NULL DEFAULT `{}` |
| `min_deposit` | DECIMAL(20,8) | nullable |
| `max_deposit` | DECIMAL(20,8) | nullable |
| `min_withdrawal` | DECIMAL(20,8) | nullable |
| `max_withdrawal` | DECIMAL(20,8) | nullable |
| `fees_config` | JSONB | DEFAULT `{}` |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() |

**Indexes:**
```sql
CREATE INDEX idx_payment_gateways_is_active ON payment_gateways(is_active);
```

**Seed Data:**
```sql
INSERT INTO payment_gateways (name, display_name, type, ...) VALUES
  ('bank_transfer', 'Bank Transfer', 'fiat', ...),
  ('crypto_btc',    'Bitcoin',       'crypto', ...),
  ('crypto_usdt',   'USDT (Tether)', 'crypto', ...);
```

---

### `notifications`
Real-time user alerts. Supabase Realtime enabled.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID PK | DEFAULT `gen_random_uuid()` |
| `user_id` | UUID | → `profiles(id)` ON DELETE CASCADE |
| `user_role` | TEXT | nullable (redundant with profiles.role) |
| `title` | TEXT | nullable |
| `message` | TEXT | nullable |
| `read` | BOOLEAN | DEFAULT false |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |

**Realtime:** Enabled via `ALTER PUBLICATION supabase_realtime ADD TABLE notifications`

---

### `subscription_payments`
Tracks sub-admin subscription fee payments to the master admin.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID PK | DEFAULT `gen_random_uuid()` |
| `sub_admin_id` | UUID | → `profiles(id)` ON DELETE CASCADE |
| `amount` | NUMERIC | NOT NULL |
| `method` | TEXT | NOT NULL |
| `status` | TEXT | DEFAULT `'Pending'` |
| `reference` | TEXT | nullable |
| `proof_url` | TEXT | nullable |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |

**Realtime:** Enabled via `ALTER PUBLICATION supabase_realtime ADD TABLE subscription_payments`

---

## Views

### `user_statistics`
Aggregated view for admin dashboards. Joins profiles, wallets, trades, and transactions.

```sql
CREATE OR REPLACE VIEW user_statistics AS
SELECT
    p.id, p.email, p.full_name, p.role, p.assigned_to,
    COALESCE(w.balance, 0) AS wallet_balance,
    w.currency,
    COUNT(DISTINCT t.id)   AS total_trades,
    COUNT(DISTINCT CASE WHEN t.status = 'open' THEN t.id END) AS open_trades,
    COUNT(DISTINCT tr.id)  AS total_transactions,
    COUNT(DISTINCT CASE WHEN tr.status = 'pending' THEN tr.id END) AS pending_transactions
FROM profiles p
LEFT JOIN wallets      w  ON p.id = w.user_id
LEFT JOIN trades       t  ON p.id = t.user_id
LEFT JOIN transactions tr ON p.id = tr.user_id
GROUP BY p.id, p.email, p.full_name, p.role, p.assigned_to, w.balance, w.currency;
```

---

## Functions

### `get_auth_role()` — SECURITY DEFINER
Returns the `user_role` of the currently authenticated user. Used in all RLS policies to avoid recursive `profiles` lookups.

```sql
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS user_role
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;
```

---

### `update_updated_at_column()` — Trigger Helper
Auto-sets `updated_at = NOW()` before any UPDATE on tracked tables.

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

### `handle_new_user()` — SECURITY DEFINER
Fires after `auth.users` INSERT. Creates a corresponding `profiles` row with role `'trader'`.

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'), 'trader');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

---

### `handle_new_profile()` — SECURITY DEFINER
Fires after `profiles` INSERT. Creates a default USD wallet with balance 0.

```sql
CREATE OR REPLACE FUNCTION handle_new_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.wallets (user_id, balance, currency)
    VALUES (NEW.id, 0, 'USD');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

---

### `handle_transaction_approval()` — SECURITY DEFINER (Trigger)
Fires BEFORE UPDATE on `transactions`. When `status` changes from `'pending'` → `'approved'`, credits or debits the user's wallet.

```sql
CREATE OR REPLACE FUNCTION handle_transaction_approval()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
        IF NEW.type = 'deposit' THEN
            UPDATE wallets SET balance = balance + NEW.amount
            WHERE user_id = NEW.user_id AND currency = NEW.currency;
        ELSIF NEW.type = 'withdrawal' THEN
            UPDATE wallets SET balance = balance - NEW.amount
            WHERE user_id = NEW.user_id AND currency = NEW.currency;
        END IF;
        NEW.processed_at = NOW();
        NEW.processed_by = auth.uid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

> ⚠ Known issue: No row-level lock — concurrent approvals can double-credit.

---

### `execute_trade(p_user_id, p_symbol, p_amount, p_type, p_entry_price)` — RPC
Atomic trade execution. Validates symbol, locks wallet row (`FOR UPDATE`), checks balance, debits wallet, inserts trade record. Returns JSONB result.

**Allowed Symbols (hardcoded list):**
- Commodities: Gold, XAUUSD, Silver, Crude Oil, Brent Crude, Natural Gas, Copper, Coffee, Wheat, Soybeans
- Global Indices: S&P 500, Nasdaq 100, Dow Jones, DAX 40, FTSE 100, Nikkei 225, Hang Seng
- Crypto: BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT, DOGEUSDT, ADAUSDT, LTCUSDT
- Forex: EURUSD, GBPUSD, USDJPY, USDCAD, AUDUSD, EURJPY, GBPJPY
- Saudi Assets: TASI, Nomu, MT30, Aramco, Sabic, Maaden, SSF, Sukuk Index

Returns:
```json
{ "success": true, "trade_id": "<uuid>", "message": "..." }
{ "success": false, "message": "<error>" }
```

---

### `close_trade(p_trade_id, p_exit_price)` — RPC (migration_v2)
Closes an open trade, calculates P&L, returns original amount + profit/loss to wallet.

**P&L Calculation:**
- BUY: `(exit_price - entry_price) * quantity`
- SELL: `(entry_price - exit_price) * quantity`

Returns:
```json
{ "success": true, "profit_loss": <decimal>, "return_amount": <decimal>, "message": "..." }
{ "success": false, "message": "<error>" }
```

---

### `approve_deposit(p_transaction_id)` — RPC
Admin-only function to approve a deposit. Validates role, locks transaction row, triggers wallet credit via `handle_transaction_approval` trigger.

---

## Triggers

| Trigger | Event | Table | Function |
|---------|-------|-------|----------|
| `update_profiles_updated_at` | BEFORE UPDATE | profiles | `update_updated_at_column()` |
| `update_wallets_updated_at` | BEFORE UPDATE | wallets | `update_updated_at_column()` |
| `update_trades_updated_at` | BEFORE UPDATE | trades | `update_updated_at_column()` |
| `update_transactions_updated_at` | BEFORE UPDATE | transactions | `update_updated_at_column()` |
| `update_payment_gateways_updated_at` | BEFORE UPDATE | payment_gateways | `update_updated_at_column()` |
| `on_auth_user_created` | AFTER INSERT | auth.users | `handle_new_user()` |
| `on_profile_created` | AFTER INSERT | profiles | `handle_new_profile()` |
| `on_transaction_status_change` | BEFORE UPDATE | transactions | `handle_transaction_approval()` |

---

## Row Level Security Policies

### `profiles`

| Policy | Operation | Rule |
|--------|-----------|------|
| Users can view own profile | SELECT | `auth.uid() = id` |
| Super Admin can view all profiles | SELECT | `get_auth_role() = 'super_admin'` |
| Sub Admin can view assigned profiles | SELECT | role = sub_admin AND (own id OR `assigned_to = auth.uid()`) |
| Super Admin can update all profiles | UPDATE | `get_auth_role() = 'super_admin'` |
| Sub Admin can update assigned profiles | UPDATE | role = sub_admin AND `assigned_to = auth.uid()` |
| Users can update own profile | UPDATE | `auth.uid() = id`, no role change allowed |
| Super Admin can insert profiles | INSERT | `get_auth_role() = 'super_admin'` |
| Super Admin can delete profiles | DELETE | `get_auth_role() = 'super_admin'` |

### `wallets`

| Policy | Operation | Rule |
|--------|-----------|------|
| Users can view own wallets | SELECT | `auth.uid() = user_id` |
| Super Admin can view all wallets | SELECT | `get_auth_role() = 'super_admin'` |
| Sub Admin can view assigned wallets | SELECT | EXISTS join via assigned_to |
| Admins can update wallets | UPDATE | super_admin OR sub_admin with assignment check |
| System can insert wallets | INSERT | `WITH CHECK (true)` — for trigger inserts |

### `trades`

| Policy | Operation | Rule |
|--------|-----------|------|
| Users can view own trades | SELECT | `auth.uid() = user_id` |
| Super Admin can view all trades | SELECT | `get_auth_role() = 'super_admin'` |
| Sub Admin can view assigned trades | SELECT | EXISTS via assigned_to |
| Users can insert own trades | INSERT | `auth.uid() = user_id` |
| Admins can insert trades | INSERT | EXISTS admin with assignment check |
| Users and Admins can update trades | UPDATE | owner OR admin with assignment check |
| Admins can delete trades | DELETE | EXISTS admin with assignment check |

### `transactions`

| Policy | Operation | Rule |
|--------|-----------|------|
| Users can view own transactions | SELECT | `auth.uid() = user_id` |
| Super Admin can view all transactions | SELECT | `get_auth_role() = 'super_admin'` |
| Sub Admin can view assigned transactions | SELECT | EXISTS via assigned_to |
| Users can create own transactions | INSERT | `auth.uid() = user_id AND status = 'pending'` |
| Admins can update transactions | UPDATE | EXISTS admin with assignment check |

### `payment_gateways`

| Policy | Operation | Rule |
|--------|-----------|------|
| Everyone can view active gateways | SELECT | `is_active = true` |
| Super Admin can view all gateways | SELECT | `get_auth_role() = 'super_admin'` |
| Super Admin can manage gateways | ALL | `get_auth_role() = 'super_admin'` |

### `notifications`

| Policy | Operation | Rule |
|--------|-----------|------|
| Users can view their own notifications | SELECT | `auth.uid() = user_id` |
| Users can update their own notifications | UPDATE | `auth.uid() = user_id` |
| Admins can insert notifications | INSERT | `WITH CHECK (true)` — ⚠ not restricted to admins |

### `subscription_payments`

| Policy | Operation | Rule |
|--------|-----------|------|
| Super admins can view all | SELECT | `get_auth_role() = 'super_admin'` |
| Super admins can update payments | UPDATE | `get_auth_role() = 'super_admin'` |
| Sub admins can view their own | SELECT | `auth.uid() = sub_admin_id` |
| Sub admins can insert their own | INSERT | `auth.uid() = sub_admin_id` |

---

## Realtime Publications

The following tables broadcast live changes via Supabase Realtime:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE trades;
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE wallets;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE subscription_payments;
```

---

## Migration History

| File | Changes |
|------|---------|
| `schema.sql` | Base schema: all tables, enums, RLS, triggers, functions, notifications, subscription_payments |
| `migration-4-2.sql` | Adds `company_slug` and `subscription_package` columns to profiles |
| `migration_v2.sql` | Adds `quantity` to trades, updates `execute_trade()`, adds `close_trade()`, adds `plain_password` and `is_banned` to profiles, enables Realtime on core tables |
