# API Endpoints & Supabase Functions — The Vault Trading Platform

> All Next.js API routes live under `src/app/api/`.
> All Supabase RPC functions are called via `supabase.rpc()` from the client or server.
> Auth is cookie-based (Supabase SSR). Service Role Key is used only server-side.

---

## Next.js API Routes

---

### `POST /api/create-tenant`
**File:** `src/app/api/create-tenant/route.ts`
**Auth Required:** Yes — `super_admin` only
**Purpose:** Provision a new Sub-Admin (tenant/brokerage company) account.

**Request Body (JSON):**
```json
{
  "email":        "company@example.com",   // required
  "password":     "securePassword123",     // required
  "full_name":    "Company Owner Name",    // required
  "company_name": "Brokerage Co.",         // optional
  "slug":         "brokerage-co"           // optional; must match /^[a-z0-9-]+$/
}
```

**Response (200):**
```json
{ "success": true, "user_id": "<uuid>", "message": "Tenant created successfully" }
```

**Response (400/401/403):**
```json
{ "error": "Forbidden" }
{ "error": "Missing required fields" }
{ "error": "Slug must be lowercase letters, numbers, and hyphens only" }
```

**Logic Flow:**
1. Verify caller is `super_admin` via session
2. Validate required fields and slug format
3. Create `auth.users` entry (auto-confirms email, skips verification)
4. `handle_new_user()` trigger auto-creates a `profiles` row as `'trader'`
5. Patch profile: set `role = 'sub_admin'`, `assigned_to = super_admin.id`, `company_slug = slug`

---

### `POST /api/create-trader`
**File:** `src/app/api/create-trader/route.ts`
**Auth Required:** Yes — `sub_admin` or `super_admin`
**Purpose:** Provision a new Trader account under a Sub-Admin.

**Request Body (JSON):**
```json
{
  "email":        "trader@example.com",    // required
  "password":     "initialPassword",       // required
  "full_name":    "Trader Full Name",      // required
  "phone_number": "+1234567890",           // optional
  "country":      "SA"                     // optional
}
```

**Request Headers:**
```
x-impersonated-id: <sub_admin_uuid>   // optional; used by super_admin acting as sub_admin
```

**Response (200):**
```json
{ "success": true, "message": "Trader created successfully", "trader": { "id": "...", "email": "...", "full_name": "..." } }
```

**Response (400/401/403/500):**
```json
{ "error": "Only administrators can create traders" }
{ "error": "Failed to create trader profile" }
```

**Logic Flow:**
1. Verify caller is `sub_admin` or `super_admin`
2. Determine `assigned_to` — uses `x-impersonated-id` header if caller is super_admin impersonating
3. Create `auth.users` entry (email auto-confirmed)
4. Update profile: `assigned_to`, `role = 'trader'`, `plain_password` ⚠
5. Insert wallet record (non-blocking — warns on failure but does not abort)

---

### `POST /api/delete-tenant`
**File:** `src/app/api/delete-tenant/route.ts`
**Auth Required:** Yes — `super_admin` only
**Purpose:** Delete a Sub-Admin (tenant) account from Supabase Auth (cascades to `profiles` and all owned data).

**Request Body (JSON):**
```json
{ "tenant_id": "<uuid>" }
```

**Response (200):**
```json
{ "success": true, "message": "Tenant deleted successfully" }
```

**Response (400/401/403):**
```json
{ "error": "Forbidden. You do not have super_admin privileges." }
{ "error": "Missing tenant ID" }
```

**Notes:**
- IDs starting with `T-` (mock tenants) return success without DB deletion
- If user is not found in Auth, returns success so frontend can clear local state
- ⚠ Contains a hardcoded email bypass at line 15 (`admin@thevault.io`) — security issue

---

### `POST /api/update-client`
**File:** `src/app/api/update-client/route.ts`
**Auth Required:** Yes — `sub_admin` or `super_admin`
**Purpose:** Edit a trader's profile, reset their password, or ban/unban their account.

**Request Body (JSON):**
```json
{
  "user_id": "<trader-uuid>",
  "action":  "update_profile" | "update_password" | "toggle_ban",
  "data":    { ... }
}
```

**`action: "update_profile"` — data fields:**
```json
{ "full_name": "...", "phone_number": "...", "country": "..." }
```

**`action: "update_password"` — data fields:**
```json
{ "password": "newPassword123" }
```
> ⚠ Also saves `plain_password` to profiles table — security concern.

**`action: "toggle_ban"` — data fields:**
```json
{ "ban": true }   // true = ban (876000h), false = unban
```

**Response (200):**
```json
{ "success": true }
```

---

### `POST /api/transactions/create`
**File:** `src/app/api/transactions/create/route.ts`
**Auth Required:** Yes — any authenticated user (trader)
**Purpose:** Submit a deposit or withdrawal request with optional proof-of-payment file upload.

**Request Format:** `multipart/form-data`

| Field | Type | Required |
|-------|------|---------|
| `type` | `"deposit"` \| `"withdrawal"` | Yes |
| `amount` | number | Yes (> 0) |
| `currency` | string | Yes (e.g., `"USD"`) |
| `payment_method` | string | Yes (e.g., `"usdt"`, `"bank_transfer"`) |
| `proof` | File | Optional |

**Response (200):**
```json
{ "success": true, "transaction": { "id": "...", "status": "pending", ... } }
```

**Response (400):**
```json
{ "error": "بيانات غير مكتملة" }   // incomplete data
{ "error": "رصيد غير كافٍ" }        // insufficient balance (withdrawal)
{ "error": "فشل رفع الصورة" }       // proof upload failed
```

**Logic Flow:**
1. Authenticate user
2. If proof file provided: upload to `payment-proofs` Supabase Storage bucket at `{user_id}/{timestamp}.{ext}`
3. If withdrawal: check wallet balance (no row lock — known race condition risk)
4. Insert `transactions` row with `status = 'pending'`

---

### `POST /api/transactions/review`
**File:** `src/app/api/transactions/review/route.ts`
**Auth Required:** Yes — `super_admin` or `sub_admin`
**Purpose:** Approve or reject a pending deposit/withdrawal request. Wallet balance is updated automatically by the `handle_transaction_approval` DB trigger.

**Request Body (JSON):**
```json
{
  "transaction_id": "<uuid>",
  "action":         "approved" | "rejected",
  "admin_notes":    "Optional note"
}
```

**Response (200):**
```json
{ "success": true, "message": "تمت الموافقة وتحديث الرصيد" }
{ "success": true, "message": "تم رفض الطلب" }
```

**Response (400/403/404):**
```json
{ "error": "ليس لديك صلاحية لهذا الطلب" }   // sub_admin accessing another tenant's transaction
{ "error": "تم معالجة هذا الطلب مسبقاً" }    // already processed
{ "error": "الطلب غير موجود" }                // not found
```

**Logic Flow:**
1. Verify caller is `super_admin` or `sub_admin`
2. Fetch transaction; if caller is `sub_admin`, verify `transaction.profiles.assigned_to === admin.id`
3. Verify `status === 'pending'` (idempotency guard)
4. Update `status`, `admin_notes`, `processed_by`, `processed_at`
5. DB trigger `on_transaction_status_change` fires → `handle_transaction_approval()` credits/debits wallet

---

### `GET /api/payment-settings`
**File:** `src/app/api/payment-settings/route.ts`
**Auth Required:** Yes (any authenticated user — should be sub_admin only)
**Purpose:** Retrieve the calling sub-admin's payment configuration.

**Response (200):**
```json
{
  "settings": {
    "sub_admin_id": "...",
    "usdt_address": "TRC20_ADDRESS",
    "usdt_network": "TRC20",
    "usdt_is_active": true,
    "btc_address": "BTC_ADDRESS",
    "btc_is_active": true,
    "bank_name": "...",
    "bank_account_holder": "...",
    "bank_rib": "...",
    "bank_is_active": true
  }
}
```
Returns `{ "settings": null }` if no settings exist yet.

---

### `POST /api/payment-settings`
**File:** `src/app/api/payment-settings/route.ts`
**Auth Required:** Yes (any authenticated user — should be sub_admin only)
**Purpose:** Create or update the calling sub-admin's payment gateway configuration (USDT, BTC, Bank Transfer).

**Request Body (JSON):**
```json
{
  "usdt_address":          "TRC20WalletAddress",
  "usdt_network":          "TRC20",
  "usdt_is_active":        true,
  "btc_address":           "BitcoinAddress",
  "btc_is_active":         true,
  "bank_name":             "Al Rajhi Bank",
  "bank_account_holder":   "Company Name",
  "bank_rib":              "SA12345678901234567890",
  "bank_is_active":        true
}
```

**Response (200):**
```json
{ "success": true }
```

**Logic:** Upserts on `sub_admin_id` conflict — creates if new, updates if exists.

---

### `GET /api/payment-settings/user`
**File:** `src/app/api/payment-settings/user/route.ts`
**Auth Required:** Yes — any authenticated user (trader)
**Purpose:** Fetch the payment settings of the trader's assigned sub-admin (broker). Used to display deposit instructions.

**Response (200):**
```json
{ "settings": { ... } }   // same shape as payment-settings GET
{ "settings": null }       // if trader has no assigned sub-admin or settings not configured
```

---

### `GET /api/db` ⚠ INSECURE
**File:** `src/app/api/db/route.ts`
**Auth Required:** NONE
**Purpose:** In-memory development scaffold for transactions/orders.
> **Should be deleted before production.** Exposes internal state without any authentication.

---

## Supabase RPC Functions

Called via `supabase.rpc('<function_name>', { params })` from client or server code.

---

### `execute_trade`
**Security:** SECURITY DEFINER (runs as owner, bypasses RLS)
**Called From:** Trader dashboard (`src/app/user/page.tsx`) when BUY/SELL is executed

**Parameters:**
```typescript
{
  p_user_id:    string,   // UUID of the trader
  p_symbol:     string,   // e.g., 'BTCUSDT', 'Gold', 'EURUSD'
  p_amount:     number,   // USD amount to invest
  p_type:       'buy' | 'sell',
  p_entry_price: number   // current market price at execution time
}
```

**Returns (JSONB):**
```json
{ "success": true,  "trade_id": "<uuid>", "message": "..." }
{ "success": false, "message": "<error_detail>" }
```

**Behavior:**
1. Validates `p_symbol` against hardcoded allowed list (~40 symbols across 5 asset classes)
2. Locks wallet row with `FOR UPDATE` to prevent concurrent debits
3. Checks `balance >= p_amount`
4. Debits wallet
5. Inserts trade with `status = 'open'`, `quantity = amount / entry_price`
6. Full atomic rollback on any error

---

### `close_trade`
**Security:** SECURITY DEFINER
**Called From:** Sub-Admin client detail page when emergency-closing a trade; also called from trader dashboard if implemented

**Parameters:**
```typescript
{
  p_trade_id:   string,   // UUID of the trade to close
  p_exit_price: number    // current market price at close time
}
```

**Returns (JSONB):**
```json
{ "success": true,  "profit_loss": 125.50, "return_amount": 1125.50, "message": "..." }
{ "success": false, "message": "<error_detail>" }
```

**Behavior:**
1. Locks trade row with `FOR UPDATE`
2. Validates trade is in `'open'` status
3. Calculates P&L:
   - BUY:  `(exit_price - entry_price) × quantity`
   - SELL: `(entry_price - exit_price) × quantity`
4. Credits wallet: `original_amount + profit_loss`
5. Updates trade: `status = 'closed'`, `exit_price`, `profit_loss`, `closed_at`

---

### `approve_deposit`
**Security:** SECURITY DEFINER
**Called From:** Admin routes (alternative to the REST endpoint)

**Parameters:**
```typescript
{ p_transaction_id: string }   // UUID of the pending deposit transaction
```

**Returns (JSONB):**
```json
{ "success": true,  "message": "..." }
{ "success": false, "message": "<error_detail>" }
```

**Behavior:**
1. Verifies caller is `super_admin` or `sub_admin`
2. Locks transaction row with `FOR UPDATE`
3. Validates `type = 'deposit'` and `status = 'pending'`
4. Sets `status = 'approved'`
5. `on_transaction_status_change` trigger fires → wallet credited automatically

---

## Supabase Realtime Subscriptions

Used in client-side hooks. No HTTP endpoints — these are WebSocket channel subscriptions.

| Hook | Channel | Filter | Event |
|------|---------|--------|-------|
| `useTransactions` | `user-transactions` | `transactions.user_id = <userId>` | UPDATE |
| `usePendingTransactions` | `admin-transactions` | none (all pending) | ALL |
| `useNotifications` | `notifications-<userId>` | `notifications.user_id = <userId>` | INSERT |
| Sub-Admin live trades | `sub-admin-trades` | — | INSERT, UPDATE, DELETE |

---

## Supabase Storage

| Bucket | Purpose | Access |
|--------|---------|--------|
| `payment-proofs` | Deposit proof-of-payment file uploads | Signed URLs (60s expiry) for admin review |

**Upload Path Pattern:** `{user_id}/{timestamp}.{extension}`

**Signed URL Generation** (in `usePendingTransactions`):
```typescript
supabase.storage.from('payment-proofs').createSignedUrl(path, 60)
```

---

## Error Code Reference

| HTTP Code | Meaning |
|-----------|---------|
| 200 | Success |
| 400 | Bad request (validation error, insufficient balance, duplicate) |
| 401 | Unauthorized (no session / not logged in) |
| 403 | Forbidden (wrong role or cross-tenant access attempt) |
| 404 | Resource not found |
| 500 | Internal server error (unexpected exception) |

---

## Auth Endpoints (Supabase Native)

These are not custom API routes — they use the Supabase client SDK directly.

| Operation | SDK Call | Used In |
|-----------|----------|---------|
| Login | `supabase.auth.signInWithPassword({ email, password })` | `login/page.tsx` |
| Register | `supabase.auth.signUp({ email, password, options: { data: { full_name } } })` | `register/page.tsx` |
| Logout | `supabase.auth.signOut()` | All dashboard headers |
| Get Session | `supabase.auth.getUser()` | All API routes + middleware |
| Password Reset | `supabase.auth.updateUser({ password })` | `update-client` API route (admin-initiated) |
| Admin Create User | `adminClient.auth.admin.createUser(...)` | `create-tenant`, `create-trader` |
| Admin Delete User | `adminClient.auth.admin.deleteUser(id)` | `delete-tenant` |
| Admin Update User | `adminClient.auth.admin.updateUserById(id, { ban_duration })` | `update-client` |
