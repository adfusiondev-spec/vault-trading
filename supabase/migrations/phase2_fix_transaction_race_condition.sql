-- ══════════════════════════════════════════════════════════
-- PHASE 2: Fix Transaction Approval Race Condition
-- ══════════════════════════════════════════════════════════
-- Problem: Concurrent approval of same transaction can credit wallet twice
-- Solution: Add row-level lock (FOR UPDATE) before wallet modification
-- Apply in: Supabase Dashboard → SQL Editor → New Query
-- ══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION handle_transaction_approval()
RETURNS TRIGGER AS $$
DECLARE
  current_balance DECIMAL(20,8);
BEGIN
  -- Only process if status changed from pending to approved
  IF OLD.status = 'pending' AND NEW.status = 'approved' THEN

    -- CRITICAL FIX: Lock wallet row to prevent concurrent double-credit
    SELECT balance INTO current_balance
    FROM wallets
    WHERE user_id = NEW.user_id AND currency = NEW.currency
    FOR UPDATE;

    IF NEW.type = 'deposit' THEN
      UPDATE wallets
        SET balance = balance + NEW.amount
        WHERE user_id = NEW.user_id AND currency = NEW.currency;

    ELSIF NEW.type = 'withdrawal' THEN
      IF current_balance < NEW.amount THEN
        RAISE EXCEPTION 'Insufficient balance. Available: %, Requested: %',
          current_balance, NEW.amount;
      END IF;

      UPDATE wallets
        SET balance = balance - NEW.amount
        WHERE user_id = NEW.user_id AND currency = NEW.currency;
    END IF;

    NEW.processed_at = NOW();
    NEW.processed_by = auth.uid();

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify trigger is still attached
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_transaction_status_change'
  ) THEN
    RAISE NOTICE 'WARNING: Trigger on_transaction_status_change not found — verify trigger exists';
  ELSE
    RAISE NOTICE 'Transaction race condition fix applied successfully ✅';
  END IF;
END $$;
