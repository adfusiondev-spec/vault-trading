import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { encryptPassword } from '@/lib/crypto'

export async function POST(request: NextRequest) {
  // 1. Verify the caller is a super_admin
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
    
  if (profile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 2. Create the new tenant user using service role
  const { email, password, full_name, company_name, slug, subscriptionPackage } = await request.json()
  
  if (!email || !password || !full_name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (slug && !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: 'Slug must be lowercase letters, numbers, and hyphens only' }, 
      { status: 400 }
    )
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Create auth user (this will trigger handle_new_user() automatically)
  const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skip email confirmation for admin-created accounts
    user_metadata: { 
      full_name,
      company_name 
    }
  })

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 })
  }

  // 3. Update role to sub_admin (profile was auto-created as 'trader' by trigger)
  const now = new Date().toISOString()
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const profileUpdate: any = {
    role: 'sub_admin',
    assigned_to: user.id,
    company_slug: slug,
    encrypted_password: encryptPassword(password),
    subscription_package: subscriptionPackage || 'Trial_1day',
  }

  if (profileUpdate.subscription_package === 'Trial_1day') {
    profileUpdate.trial_started_at = now
    profileUpdate.expires_at = expires
  }

  const { error: roleError } = await adminClient
    .from('profiles')
    .update(profileUpdate)
    .eq('id', newUser.user.id)

  if (roleError) {
    return NextResponse.json({ error: roleError.message }, { status: 400 })
  }

  // Auto-create initial subscription_payment record so tenant sees their dashboard
  const { error: subPaymentError } = await (adminClient as any)
    .from('subscription_payments')
    .insert({
      sub_admin_id: newUser.user.id,
      amount: 0,
      method: 'setup',
      status: 'Pending',
      billing_cycle: 'monthly',
      package: 'starter',
      trial_option: 'none',
      trial_days: 0,
      full_amount: 0,
      reference: `Initial setup — ${email}`,
    })

  if (subPaymentError) {
    console.error('Failed to create subscription payment record:', subPaymentError)
    // Non-fatal — tenant is still created successfully
  }

  return NextResponse.json({
    success: true,
    user_id: newUser.user.id,
    message: 'Tenant created successfully'
  })
}
