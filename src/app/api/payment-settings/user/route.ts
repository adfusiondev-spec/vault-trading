import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('assigned_to')
    .eq('id', user.id)
    .single()

  if (!profile?.assigned_to) {
    // No company assigned — return empty but valid response
    return NextResponse.json({ settings: null })
  }

  const { data: settings } = await supabase
    .from('payment_settings')
    .select('*')
    .eq('sub_admin_id', profile.assigned_to)
    .single()

  return NextResponse.json({ settings: settings ?? null })
}
