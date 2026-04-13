import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // التحقق من صلاحية الأدمن
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('role, id')
    .eq('id', user.id)
    .single()

  if (!adminProfile || !['super_admin', 'sub_admin'].includes(adminProfile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { transaction_id, action, admin_notes } = await request.json()
  // action: 'approved' | 'rejected'

  if (!['approved', 'rejected'].includes(action)) {
    return NextResponse.json({ error: 'action غير صالح' }, { status: 400 })
  }

  // التحقق أن Sub-Admin يعالج فقط عملاء شركته
  const { data: transaction } = await supabase
    .from('transactions')
    .select('*, profiles!transactions_user_id_fkey(assigned_to)')
    .eq('id', transaction_id)
    .single()

  if (!transaction) {
    return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 })
  }

  if (
    adminProfile.role === 'sub_admin' &&
    transaction.profiles?.assigned_to !== adminProfile.id
  ) {
    return NextResponse.json({ error: 'ليس لديك صلاحية لهذا الطلب' }, { status: 403 })
  }

  if (transaction.status !== 'pending') {
    return NextResponse.json({ error: 'تم معالجة هذا الطلب مسبقاً' }, { status: 400 })
  }

  // تحديث الحالة — الـ Trigger يتولى تحديث الرصيد تلقائياً
  const { error } = await supabase
    .from('transactions')
    .update({
      status: action,
      admin_notes,
      processed_by: user.id,
      processed_at: new Date().toISOString()
    })
    .eq('id', transaction_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ 
    success: true, 
    message: action === 'approved' ? 'تمت الموافقة وتحديث الرصيد' : 'تم رفض الطلب'
  })
}
