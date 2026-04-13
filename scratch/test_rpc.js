import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Load env
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function testClose() {
  console.log('--- TESTING CLOSE_TRADE RPC ---');
  
  // 1. Get an open trade
  const { data: trades, error: tError } = await supabase.from('trades').select('*').eq('status', 'open').limit(1);
  
  if (tError) {
     console.error('Error fetching trades:', tError);
     return;
  }
  
  if (!trades || trades.length === 0) {
     console.log('No open trades found to test.');
     return;
  }
  
  const trade = trades[0];
  console.log('Testing with trade:', trade.id, 'Asset:', trade.symbol);
  console.log('Current Quantity:', trade.quantity);
  
  if (trade.quantity === null) {
     console.log('Detected NULL quantity. The fix uses COALESCE(quantity, amount/entry_price).');
     const fallbackQty = trade.amount / trade.entry_price;
     console.log('Fallback Quantity:', fallbackQty);
  }

  // 2. Try to close it
  console.log('Executing RPC close_trade...');
  const { data, error } = await supabase.rpc('close_trade', {
    p_trade_id: trade.id,
    p_exit_price: trade.entry_price * 1.05
  });
  
  if (error) {
    console.error('RPC Error:', error);
    console.log('\nIMPORTANT: This error is expected until migration_v2.sql is re-run in Supabase.');
  } else {
    console.log('RPC Result:', data);
  }
}

testClose();
