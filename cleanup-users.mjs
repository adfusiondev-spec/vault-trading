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

async function cleanSpecificUsers() {
  const emails = ['john@capital.org', 'sarah.c@techinvest.io'];
  console.log('--- CLEANING SPECIFIC EXPERIMENTAL USERS ---');

  for (const email of emails) {
    console.log(`Searching for ${email}...`);
    const { data: users, error: findError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email);

    if (users && users.length > 0) {
      for (const u of users) {
        console.log(`Deleting ${email} (${u.id})...`);
        await supabase.auth.admin.deleteUser(u.id);
      }
    } else {
      console.log(`User ${email} not found in profiles (already gone).`);
    }
  }

  console.log('--- CLEANUP COMPLETE ---');
}

cleanSpecificUsers();
