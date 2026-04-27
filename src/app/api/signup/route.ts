import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { encryptPassword } from '@/lib/crypto'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
}

export async function POST(request: NextRequest) {
  try {
    const { company_name, full_name, email, password, phone_number, country } = await request.json()

    if (!company_name || !email || !password || !phone_number || !country) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Resolve super_admin ID (for assigned_to FK)
    const { data: superAdmin } = await adminClient
      .from('profiles')
      .select('id')
      .eq('role', 'super_admin')
      .limit(1)
      .single()

    if (!superAdmin) {
      return NextResponse.json({ error: 'Platform not configured. Please contact support.' }, { status: 500 })
    }

    // 2. Generate a unique company slug
    const baseSlug = slugify(company_name) || 'company'
    let slug = baseSlug
    const { data: existing } = await adminClient
      .from('profiles')
      .select('company_slug')
      .eq('company_slug', baseSlug)
      .maybeSingle()

    if (existing) {
      const suffix = Math.floor(1000 + Math.random() * 9000)
      slug = `${baseSlug}-${suffix}`
    }

    // 3. Create auth user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || company_name,
        company_name,
      },
    })

    if (createError) {
      // Surface friendly duplicate-email message
      const msg = createError.message.toLowerCase().includes('already')
        ? 'An account with this email already exists.'
        : createError.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    // 4. Promote to sub_admin and apply trial defaults
    const now = new Date().toISOString()
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const invite_token = crypto.randomUUID()

    const { error: profileError } = await adminClient
      .from('profiles')
      .update({
        role: 'sub_admin',
        assigned_to: superAdmin.id,
        company_slug: slug,
        encrypted_password: encryptPassword(password),
        phone_number: phone_number || null,
        country: country || null,
        invite_token,
        subscription_package: 'Trial_1day',
        trial_started_at: now,
        expires_at: expires,
        sales_limit: 3,
      })
      .eq('id', newUser.user.id)

    if (profileError) {
      return NextResponse.json({ error: 'Failed to configure account. Please contact support.' }, { status: 500 })
    }

    // 5. Stub subscription_payments record (non-fatal)
    await adminClient.from('subscription_payments').insert({
      sub_admin_id: newUser.user.id,
      amount: 0,
      method: 'setup',
      status: 'Pending',
      billing_cycle: 'monthly',
      package: 'starter',
      trial_option: 'none',
      trial_days: 0,
      full_amount: 0,
      reference: `Self-signup trial — ${email}`,
    })

    // 6. Default virtual payment settings (non-fatal)
    await adminClient.from('sub_admin_payment_settings').insert({
      sub_admin_id: newUser.user.id,
      bank_name: 'Nokhba Global Bank',
      bank_account_holder: 'Virtual Trial Account',
      bank_rib: 'VIRTUAL-IBAN-00000000',
      bank_is_active: true,
      btc_address: 'bc1q-virtual-nokhba-default-btc-address-000',
      btc_is_active: true,
      usdt_address: 'T-virtual-nokhba-default-usdt-address-000',
      usdt_network: 'TRC20',
      usdt_is_active: true,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
