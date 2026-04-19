import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { email, password, full_name, phone_number, country, invite_token } = await request.json()

    if (!email || !password || !full_name || !invite_token) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Verify invite token and resolve sub_admin
    const { data: subAdmin, error: tokenError } = await adminClient
      .from('profiles')
      .select('id, role, company_slug')
      .eq('invite_token', invite_token)
      .eq('role', 'sub_admin')
      .single()

    if (tokenError || !subAdmin) {
      return NextResponse.json({ error: 'Invalid invite link' }, { status: 400 })
    }

    // 2. Create auth user (email confirmation skipped — admin-trusted invite)
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // 3. Assign trader role and link to sub_admin
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({
        role: 'trader',
        assigned_to: subAdmin.id,
        phone_number: phone_number || null,
        country: country || null,
      })
      .eq('id', authData.user.id)

    if (profileError) {
      return NextResponse.json({ error: 'Failed to complete registration' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Registration successful.',
      redirect_to: '/login',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
