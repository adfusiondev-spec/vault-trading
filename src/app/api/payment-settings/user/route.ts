import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

    // Get trader's assigned sub_admin
    const { data: profile } = await adminClient
      .from('profiles')
      .select('assigned_to')
      .eq('id', user.id)
      .single()

    if (!profile?.assigned_to) {
      return NextResponse.json({ settings: null })
    }

    // Try sub_admin_payment_settings first (per-sub-admin settings)
    const { data: subAdminSettings, error: subErr } = await adminClient
      .from('sub_admin_payment_settings')
      .select('*')
      .eq('sub_admin_id', profile.assigned_to)
      .single()

    if (subAdminSettings) {
      return NextResponse.json({ settings: subAdminSettings })
    }

    // Fall back to legacy payment_settings table
    if (subErr && subErr.code !== 'PGRST116') {
      return NextResponse.json({ error: subErr.message }, { status: 500 })
    }

    const { data: legacySettings } = await adminClient
      .from('payment_settings')
      .select('*')
      .eq('sub_admin_id', profile.assigned_to)
      .single()

    return NextResponse.json({ settings: legacySettings ?? null })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
