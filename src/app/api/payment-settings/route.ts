import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('payment_settings')
    .select('*')
    .eq('sub_admin_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ settings: data ?? null })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  const { error } = await supabase
    .from('payment_settings')
    .upsert({
      sub_admin_id: user.id,
      usdt_address: body.usdt_address ?? null,
      usdt_network: body.usdt_network ?? 'TRC20',
      usdt_is_active: body.usdt_is_active ?? true,
      btc_address: body.btc_address ?? null,
      btc_is_active: body.btc_is_active ?? true,
      bank_name: body.bank_name ?? null,
      bank_account_holder: body.bank_account_holder ?? null,
      bank_rib: body.bank_rib ?? null,
      bank_is_active: body.bank_is_active ?? true,
    }, { onConflict: 'sub_admin_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
