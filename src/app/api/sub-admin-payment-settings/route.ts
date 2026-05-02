import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: settings, error } = await adminClient
      .from('sub_admin_payment_settings')
      .select('*')
      .eq('sub_admin_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ settings: settings ?? null })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      usdt_address, usdt_network, usdt_is_active,
      btc_address, btc_is_active,
      bank_name, bank_account_holder, bank_rib, bank_swift, bank_is_active,
    } = body

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await adminClient
      .from('sub_admin_payment_settings')
      .upsert({
        sub_admin_id: user.id,
        usdt_address: usdt_address ?? null,
        usdt_network: usdt_network ?? 'TRC20',
        usdt_is_active: usdt_is_active ?? true,
        btc_address: btc_address ?? null,
        btc_is_active: btc_is_active ?? true,
        bank_name: bank_name ?? null,
        bank_account_holder: bank_account_holder ?? null,
        bank_rib: bank_rib ?? null,
        bank_swift: bank_swift ?? null,
        bank_is_active: bank_is_active ?? true,
      }, { onConflict: 'sub_admin_id' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
