import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { user_id, action, data } = await request.json()

    // 1. Verify caller is sub_admin or super_admin
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'sub_admin' && profile.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Only administrators can perform this action' }, { status: 403 })
    }

    // 2. Initialize admin client (bypasses RLS)
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // ── Update profile fields (name, phone, country) ──
    if (action === 'update_profile') {
      const { error } = await adminClient
        .from('profiles')
        .update(data)
        .eq('id', user_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ success: true })
    }

    // ── Reset client password ──
    if (action === 'update_password') {
      const { error } = await adminClient.auth.admin.updateUserById(user_id, {
        password: data.password
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      return NextResponse.json({ success: true })
    }

    // ── Ban / Unban client ──
    if (action === 'toggle_ban') {
      const banDuration = data.ban ? '876000h' : 'none' // 100 years or lift ban
      const { error } = await adminClient.auth.admin.updateUserById(user_id, {
        ban_duration: banDuration
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      // Reflect ban status in profiles table
      await adminClient
        .from('profiles')
        .update({ is_banned: data.ban })
        .eq('id', user_id)

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  } catch (error: any) {
    console.error('[update-client]', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
