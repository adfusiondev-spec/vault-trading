-- ============================================
-- The Vault - Database Migration v3
-- Lead Status + Manual Balance Adjustment
-- ============================================

-- 1. Add lead_status column to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'lead_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN lead_status TEXT DEFAULT 'Active';
  END IF;
END $$;

-- 2. Backfill existing trader profiles with default status
UPDATE profiles SET lead_status = 'Active' WHERE lead_status IS NULL AND role = 'trader';
