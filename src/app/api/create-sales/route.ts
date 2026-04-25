import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { encryptPassword } from '@/lib/crypto'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role, id, company_slug, sales_limit')
      .eq('id', user.id)
      .single()

    if ((adminProfile as any)?.role !== 'sub_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { count: currentSalesCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact' })
      .eq('assigned_to', user.id)
      .eq('role', 'sales')

    const salesLimit = (adminProfile as any)?.sales_limit || 0
    if ((currentSalesCount || 0) >= salesLimit) {
      return NextResponse.json({
        error: `Sales limit reached. Maximum ${salesLimit} sales users allowed.`
      }, { status: 400 })
    }

    const body = await req.json()
    const { email, password, full_name, phone_number, country } = body

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const adminSupa = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: newUser, error: createError } = await adminSupa.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })

    if (createError || !newUser.user) {
      return NextResponse.json({ error: createError?.message }, { status: 500 })
    }

    const referralCode = `${(adminProfile as any).company_slug}-${newUser.user.id.slice(0, 8)}`

    // Wait for the handle_new_user trigger to finish setting default values
    await new Promise(resolve => setTimeout(resolve, 500))

    const { error: updateError } = await adminSupa
      .from('profiles')
      .update({
        role: 'sales',
        assigned_to: user.id,
        company_slug: (adminProfile as any).company_slug,
        full_name,
        phone_number: phone_number || null,
        country: country || null,
        referral_code: referralCode,
        encrypted_password: encryptPassword(password),
      })
      .eq('id', newUser.user.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Verify role was set correctly; if trigger overwrote it, force a second update
    const { data: verifyProfile } = await adminSupa
      .from('profiles')
      .select('role')
      .eq('id', newUser.user.id)
      .single()

    if (verifyProfile?.role !== 'sales') {
      await adminSupa
        .from('profiles')
        .update({ role: 'sales' })
        .eq('id', newUser.user.id)
    }

    return NextResponse.json({
      success: true,
      sales_user: {
        id: newUser.user.id,
        email,
        full_name,
        referral_code: referralCode,
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
