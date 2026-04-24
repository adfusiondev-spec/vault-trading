import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'

const SUPABASE_URL = 'https://gvxyozlzrgtypyfjybfw.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2eHlvemx6cmd0eXB5Zmp5YmZ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc1MzU1NywiZXhwIjoyMDkxMzI5NTU3fQ.XaXaqxJFrZncd4WBL6IqROvFgqkANUlAXiRg-EQvSLs'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function exportTable() {
  console.log('📦 Exporting payment_settings table...')

  const { data, error } = await supabase
    .from('payment_settings')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('❌ Error fetching payment_settings:', error.message)
    process.exit(1)
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `payment_settings_backup_${timestamp}.json`
  const backupPath = `/Users/mac/Desktop/Vault_Trading/scratch/${filename}`

  const backupContent = {
    table: 'public.payment_settings',
    exported_at: new Date().toISOString(),
    row_count: data.length,
    schema: {
      id: 'uuid (PK)',
      sub_admin_id: 'uuid (FK → profiles.id, UNIQUE, nullable)',
      usdt_address: 'text',
      usdt_network: 'text (default: TRC20)',
      usdt_is_active: 'boolean (default: true)',
      btc_address: 'text',
      btc_is_active: 'boolean (default: true)',
      bank_name: 'text',
      bank_account_holder: 'text',
      bank_rib: 'text',
      bank_is_active: 'boolean (default: true)',
      updated_at: 'timestamptz (default: now())'
    },
    rows: data
  }

  writeFileSync(backupPath, JSON.stringify(backupContent, null, 2), 'utf8')

  console.log(`✅ Backup saved to: ${backupPath}`)
  console.log(`📊 Total rows exported: ${data.length}`)

  if (data.length > 0) {
    console.log('\n📋 Rows summary:')
    data.forEach((row, i) => {
      console.log(`  [${i + 1}] id: ${row.id}`)
      console.log(`       sub_admin_id: ${row.sub_admin_id ?? 'NULL (Admin record)'}`)
      console.log(`       usdt_address: ${row.usdt_address ?? 'null'}`)
      console.log(`       btc_address: ${row.btc_address ?? 'null'}`)
      console.log(`       bank_name: ${row.bank_name ?? 'null'}`)
      console.log(`       updated_at: ${row.updated_at}`)
      console.log()
    })
  } else {
    console.log('\n⚠️  Table is currently empty (no rows).')
  }
}

exportTable()
