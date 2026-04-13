import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Load env
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function applyMigration() {
  console.log('--- APPLYING COLUMN MIGRATION ---');

  const sql = `
    DO $$ 
    BEGIN 
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='phone_number') THEN
        ALTER TABLE profiles ADD COLUMN phone_number TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='country') THEN
        ALTER TABLE profiles ADD COLUMN country TEXT;
      END IF;
    END $$;
  `;

  // Use the admin endpoint to run SQL if available, otherwise just warn
  // Supabase doesn't have a direct "run sql" REST endpoint without an RPC.
  // I'll advise the user to run it in the dashboard since I can't guarantee an RPC exists.
  console.log('Please run the following SQL in your Supabase SQL Editor:');
  console.log(sql);
}

applyMigration();
