import { createClient } from '@supabase/supabase-js'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { decryptPassword } from '@/lib/crypto'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { user_id } = await request.json()
    if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: requesterProfile } = await (supabase as any)
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!requesterProfile || !['super_admin', 'sub_admin'].includes(requesterProfile.role)) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: targetProfile } = await adminClient
      .from('profiles')
      .select('encrypted_password, assigned_to')
      .eq('id', user_id)
      .single()

    if (!targetProfile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    if (requesterProfile.role === 'sub_admin' && targetProfile.assigned_to !== user.id) {
      return NextResponse.json({ error: 'Forbidden: Not your assigned user' }, { status: 403 })
    }

    if (!targetProfile.encrypted_password) {
      return NextResponse.json({ error: 'No password reference available' }, { status: 404 })
    }

    return NextResponse.json({ success: true, password: decryptPassword(targetProfile.encrypted_password) })
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to decrypt password' }, { status: 500 })
  }
}
