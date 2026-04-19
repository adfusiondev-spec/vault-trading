# The Vault — Backup Log

## Backup: Pre-Phase-1-2
- **Date:** 2026-04-19
- **Commit Hash:** 86576dd
- **Branch:** main
- **Database:** Supabase project gvxyozlzrgtypyfjybfw (no schema changes in this phase code changes)

### Restore Command
```bash
git reset --hard 86576dd
```

## Phase 1 — Security Audit Findings

| Check | Result |
|---|---|
| Hardcoded secrets in code | ✅ CLEAN |
| `SUPABASE_SERVICE_ROLE_KEY` in client code | ✅ Server-side API routes only (correct) |
| Console.log with passwords/tokens/balances | ✅ CLEAN |
| SQL injection via string concatenation | ✅ CLEAN |
| Unprotected API routes | ⚠️ `/api/db` — already disabled (returns 404), no risk |
| `plain_password` in API code | ✅ Already removed from all routes |
| `vault_pw_*` password in localStorage (read) | ⚠️ REMOVED in Phase 1 fix |
| Next.js high vulnerability (DoS) | ⚠️ Upgraded to 16.2.4 in Phase 1 fix |

## Phase 2 — Database Migrations (Apply Manually in Supabase)

1. `phase2_remove_plain_password.sql` — Drop `profiles.plain_password` column
2. `phase2_fix_transaction_race_condition.sql` — Add `FOR UPDATE` lock to wallet trigger
3. `phase2_audit_rls_policies.sql` — Tighten notifications + wallets RLS policies

## Changes Applied
- Removed `vault_pw_${trader.id}` localStorage read from sub-admin page
- Upgraded Next.js 16.2.2 → 16.2.4 (DoS fix)
- Created 3 migration SQL files for manual Supabase application
