-- ══════════════════════════════════════════════════════════
-- PHASE 2: RLS Policy Audit & Hardening
-- ══════════════════════════════════════════════════════════
-- Apply in: Supabase Dashboard → SQL Editor → New Query
-- ══════════════════════════════════════════════════════════

BEGIN;

-- ═══ FIX 1: Tighten Notifications INSERT Policy
DROP POLICY IF EXISTS "Admins can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;

CREATE POLICY "Admins can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'sub_admin')
  );

-- ═══ FIX 2: Tighten Wallets INSERT Policy (only triggers/service role)
DROP POLICY IF EXISTS "System can insert wallets" ON wallets;
DROP POLICY IF EXISTS "Users can insert own wallet" ON wallets;

CREATE POLICY "System can insert wallets"
  ON wallets FOR INSERT
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
  );

-- ═══ AUDIT REPORT: List all current policies
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  RAISE NOTICE '══════════════════════════════════════';
  RAISE NOTICE 'RLS POLICY AUDIT REPORT';
  RAISE NOTICE '══════════════════════════════════════';

  FOR policy_record IN
    SELECT tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname
  LOOP
    RAISE NOTICE 'Table: % | Policy: % | Cmd: %',
      policy_record.tablename,
      policy_record.policyname,
      policy_record.cmd;
  END LOOP;

  RAISE NOTICE '══════════════════════════════════════';
END $$;

COMMIT;
