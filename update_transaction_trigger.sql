CREATE OR REPLACE FUNCTION handle_transaction_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_balance DECIMAL;
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
    IF NEW.type = 'withdrawal' THEN
      SELECT balance INTO v_balance FROM wallets
      WHERE user_id = NEW.user_id AND currency = NEW.currency;
      
      IF v_balance < NEW.amount THEN
        RAISE EXCEPTION 'رصيد غير كافٍ للسحب: مطلوب % متوفر %', NEW.amount, v_balance;
      END IF;
      
      UPDATE wallets SET balance = balance - NEW.amount
      WHERE user_id = NEW.user_id AND currency = NEW.currency;
    ELSIF NEW.type = 'deposit' THEN
      UPDATE wallets SET balance = balance + NEW.amount
      WHERE user_id = NEW.user_id AND currency = NEW.currency;
    END IF;
    
    NEW.processed_at = NOW();
    NEW.processed_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
