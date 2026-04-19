import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const type = formData.get('type') as 'deposit' | 'withdrawal'
  const amount = parseFloat(formData.get('amount') as string)
  const currency = formData.get('currency') as string
  const payment_method = formData.get('payment_method') as string
  const proof_file = formData.get('proof') as File | null

  // Validation
  if (!type || !amount || amount <= 0 || !currency || !payment_method) {
    return NextResponse.json({ error: 'بيانات غير مكتملة' }, { status: 400 })
  }

  // رفع صورة الإثبات إلى Supabase Storage
  let proof_url = null
  if (proof_file) {
    const fileExt = proof_file.name.split('.').pop()
    const filePath = `${user.id}/${Date.now()}.${fileExt}`
    
    const { error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(filePath, proof_file)
    
    if (uploadError) {
      return NextResponse.json({ error: 'فشل رفع الصورة' }, { status: 400 })
    }
    proof_url = filePath
  }

  // Pre-check for UX only — authoritative enforcement is in
  // handle_transaction_approval() DB trigger with FOR UPDATE lock.
  if (type === 'withdrawal') {
    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', user.id)
      .eq('currency', currency)
      .single()
    
    if (!wallet || wallet.balance < amount) {
      return NextResponse.json({ error: 'رصيد غير كافٍ' }, { status: 400 })
    }
  }

  // إنشاء طلب المعاملة
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: user.id,
      type,
      amount,
      currency,
      payment_method,
      proof_of_payment_url: proof_url,
      status: 'pending'
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Notify the sub-admin of the new transaction request
  const { data: traderProfile } = await (supabase as any)
    .from('profiles')
    .select('assigned_to, full_name')
    .eq('id', user.id)
    .single()

  if (traderProfile?.assigned_to) {
    await (supabase as any).from('notifications').insert({
      user_id: traderProfile.assigned_to,
      user_role: 'sub_admin',
      title: `New ${type === 'deposit' ? 'Deposit' : 'Withdrawal'} Request`,
      message: `${traderProfile.full_name || 'A trader'} submitted a ${type} of ${amount} ${currency}.`,
      read: false,
    })
  }

  return NextResponse.json({ success: true, transaction: data })
}
