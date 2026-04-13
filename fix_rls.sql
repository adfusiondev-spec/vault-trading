-- ============================================================
-- Fix: RLS Policies for Transactions & Profiles
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Fix Sub Admin transactions policy (avoid circular RLS)
DROP POLICY IF EXISTS "Sub Admin can view assigned transactions" ON transactions;
CREATE POLICY "Sub Admin can view assigned transactions"
  ON transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'sub_admin'
      AND transactions.user_id IN (
        SELECT u.id FROM profiles u WHERE u.assigned_to = p.id
      )
    )
  );

-- 2. Fix Super Admin transactions policy (use EXISTS not get_auth_role)
DROP POLICY IF EXISTS "Super Admin can view all transactions" ON transactions;
CREATE POLICY "Super Admin can view all transactions"
  ON transactions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- 3. Fix Sub Admin trades policy (avoid circular RLS)
DROP POLICY IF EXISTS "Sub Admin can view assigned trades" ON trades;
CREATE POLICY "Sub Admin can view assigned trades"
  ON trades FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'sub_admin'
      AND trades.user_id IN (
        SELECT u.id FROM profiles u WHERE u.assigned_to = p.id
      )
    )
  );

-- 4. Fix Super Admin trades policy
DROP POLICY IF EXISTS "Super Admin can view all trades" ON trades;
CREATE POLICY "Super Admin can view all trades"
  ON trades FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- 5. Add notes column if not exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notes TEXT;
