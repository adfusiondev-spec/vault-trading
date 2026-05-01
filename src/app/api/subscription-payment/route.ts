import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendSubscriptionPaymentAlert } from '@/lib/email'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const sub_admin_id = formData.get('sub_admin_id') as string
  const amount = parseFloat(formData.get('amount') as string)
  const method = formData.get('method') as string
  const reference = formData.get('reference') as string
  const package_name = formData.get('package') as string
  const billing_cycle = formData.get('billing_cycle') as string
  const trial_option = formData.get('trial_option') as string
  const trial_days = parseInt(formData.get('trial_days') as string)
  const full_amount = parseFloat(formData.get('full_amount') as string)
  const proof_file = formData.get('proof') as File | null

  const isTrial = trial_option && trial_option !== 'none'
  if (!sub_admin_id || (!isTrial && !method)) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Verify caller is the sub_admin themselves or a super_admin
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isSubAdmin = user.id === sub_admin_id
  const isSuperAdmin = callerProfile?.role === 'super_admin'
  if (!isSubAdmin && !isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Use service role to bypass RLS for both storage and DB insert
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let proof_url: string | null = null
  if (proof_file) {
    const ext = proof_file.name.split('.').pop()
    const filePath = `${sub_admin_id}/${Date.now()}.${ext}`
    const { error: uploadErr } = await service.storage
      .from('payment-proofs')
      .upload(filePath, proof_file)
    if (uploadErr) return NextResponse.json({ error: 'Proof upload failed: ' + uploadErr.message }, { status: 400 })
    proof_url = filePath
  }

  const { error } = await service.from('subscription_payments').insert([{
    sub_admin_id,
    amount,
    method,
    status: 'Pending',
    reference,
    proof_url,
    package: package_name,
    billing_cycle,
    trial_option,
    trial_days,
    full_amount,
  }])

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Notify super_admin (fire-and-forget — non-fatal)
  const { data: subAdminProfile } = await service
    .from('profiles')
    .select('email')
    .eq('id', sub_admin_id)
    .single()

  sendSubscriptionPaymentAlert(
    subAdminProfile?.email ?? sub_admin_id,
    package_name,
    amount,
    method
  ).catch(console.error)

  return NextResponse.json({ success: true })
}
