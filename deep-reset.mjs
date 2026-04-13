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

async function deepReset() {
  console.log('--- STARTING DEEP RESET ---');

  // 1. Fetch all sub_admin profiles
  const { data: subAdmins, error: fetchError } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('role', 'sub_admin');

  if (fetchError) {
    console.error('Error fetching sub_admins:', fetchError.message);
    process.exit(1);
  }

  console.log(`Found ${subAdmins.length} sub_admin accounts to delete.`);

  // 2. Delete each one from Auth
  for (const admin of subAdmins) {
    console.log(`Deleting ${admin.email} (${admin.id})...`);
    const { error: deleteError } = await supabase.auth.admin.deleteUser(admin.id);
    if (deleteError) {
      console.warn(`Could not delete Auth user ${admin.id}: ${deleteError.message}`);
      // Even if Auth fails, try to delete the profile record
      await supabase.from('profiles').delete().eq('id', admin.id);
    }
  }

  // 3. Optional: Delete any orphaned traders that might belong to these admins
  // (Profiles table CASCADE should handle most, but let's be thorough)
  const { data: abandonedTraders } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'trader')
    .is('assigned_to', null);

  if (abandonedTraders && abandonedTraders.length > 0) {
     console.log(`Cleaning up ${abandonedTraders.length} orphaned traders...`);
     for (const trader of abandonedTraders) {
       await supabase.auth.admin.deleteUser(trader.id);
     }
  }

  console.log('--- DEEP RESET COMPLETE ---');
}

deepReset();
