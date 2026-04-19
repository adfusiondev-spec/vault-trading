-- ══════════════════════════════════════════════════════════
-- PHASE 2: Remove plain_password Column (Security Critical)
-- ══════════════════════════════════════════════════════════
-- WARNING: This migration is IRREVERSIBLE by design (security)
-- Plaintext passwords should NEVER exist in production
-- Apply in: Supabase Dashboard → SQL Editor → New Query
-- ══════════════════════════════════════════════════════════

BEGIN;

-- 1. Log existing data count (for audit trail)
DO $$
DECLARE
  plain_pwd_count INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'plain_password'
  ) THEN
    SELECT COUNT(*) INTO plain_pwd_count
    FROM profiles
    WHERE plain_password IS NOT NULL AND plain_password <> '';
    RAISE NOTICE 'Records with plain_password data: %', plain_pwd_count;
  ELSE
    RAISE NOTICE 'plain_password column does not exist — already clean.';
  END IF;
END $$;

-- 2. Drop the column (irreversible)
ALTER TABLE profiles DROP COLUMN IF EXISTS plain_password;

-- 3. Verify removal
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'plain_password'
  ) THEN
    RAISE EXCEPTION 'Failed to remove plain_password column';
  END IF;
  RAISE NOTICE 'plain_password column removed successfully ✅';
END $$;

COMMIT;
