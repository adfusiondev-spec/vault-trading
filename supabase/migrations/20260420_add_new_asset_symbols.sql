-- Migration: Add new tradeable symbols to execute_trade()
-- New assets: ALRAJHI, SABIC, SNB, ACWA (Saudi stocks)
--             US30, US500, NAS100, GER40 (Global Indices)
--             TSLA, NVDA, AAPL, MSFT (Global Stocks)

CREATE OR REPLACE FUNCTION execute_trade(
  p_user_id     UUID,
  p_symbol      TEXT,
  p_amount      NUMERIC,
  p_type        TEXT,
  p_entry_price NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_balance  NUMERIC;
  v_quantity        NUMERIC;
  v_trade_id        UUID;
  v_allowed_symbols TEXT[] := ARRAY[
    -- Crypto
    'BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','DOGEUSDT','ADAUSDT','LTCUSDT',
    -- Precious Metals
    'XAUUSD','XAGUSD','XPTUSD','XPDUSD',
    -- Energy
    'WTIUSD','BRTUSD','NGAS','GASUSD',
    -- FX Majors & Minors
    'EURUSD','GBPUSD','USDJPY','USDCHF','AUDUSD','USDCAD','NZDUSD',
    'EURGBP','EURJPY','GBPJPY','USDSEK','USDNOK',
    -- Saudi & Regional (existing)
    'TASI','ARAMCO','DFM','QE',
    -- Saudi & Regional (new)
    'ALRAJHI','SABIC','SNB','ACWA',
    -- Global Indices (new)
    'US30','US500','NAS100','GER40',
    -- Global Stocks (new)
    'TSLA','NVDA','AAPL','MSFT'
  ];
  v_quantity_calc NUMERIC;
BEGIN
  -- Validate symbol
  IF NOT (p_symbol = ANY(v_allowed_symbols)) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Symbol not allowed: ' || p_symbol);
  END IF;

  -- Validate type
  IF p_type NOT IN ('buy', 'sell') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid trade type');
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Amount must be greater than 0');
  END IF;

  -- Lock wallet row and get balance
  SELECT balance INTO v_wallet_balance
    FROM wallets
    WHERE user_id = p_user_id AND currency = 'USD'
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Wallet not found');
  END IF;

  -- Check sufficient balance
  IF v_wallet_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient balance');
  END IF;

  -- Calculate quantity
  v_quantity_calc := p_amount / NULLIF(p_entry_price, 0);

  -- Debit wallet
  UPDATE wallets
    SET balance = balance - p_amount
    WHERE user_id = p_user_id AND currency = 'USD';

  -- Insert trade record
  INSERT INTO trades (user_id, symbol, type, amount, entry_price, quantity, status)
    VALUES (p_user_id, p_symbol, p_type::trade_type, p_amount, p_entry_price, v_quantity_calc, 'open')
    RETURNING id INTO v_trade_id;

  RETURN jsonb_build_object(
    'success', true,
    'trade_id', v_trade_id,
    'message', 'Trade executed successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
