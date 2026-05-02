import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const DEFAULTS = { base_price: 300, global_indices_addon: 100, saudi_indices_addon: 300 }

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data } = await (supabase as any)
      .from('pricing_config')
      .select('base_price, global_indices_addon, saudi_indices_addon')
      .eq('id', 1)
      .single()

    return NextResponse.json(data ?? DEFAULTS)
  } catch {
    return NextResponse.json(DEFAULTS)
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if ((profile as any)?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const base_price = Number(body.base_price)
    const global_indices_addon = Number(body.global_indices_addon)
    const saudi_indices_addon = Number(body.saudi_indices_addon)

    if (
      isNaN(base_price) || base_price < 0 ||
      isNaN(global_indices_addon) || global_indices_addon < 0 ||
      isNaN(saudi_indices_addon) || saudi_indices_addon < 0
    ) {
      return NextResponse.json({ error: 'Invalid pricing values' }, { status: 400 })
    }

    const { error } = await (supabase as any)
      .from('pricing_config')
      .update({ base_price, global_indices_addon, saudi_indices_addon, updated_at: new Date().toISOString() })
      .eq('id', 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
