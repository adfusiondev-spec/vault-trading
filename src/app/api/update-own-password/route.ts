import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { encryptPassword } from '@/lib/crypto'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error: authError } = await adminClient.auth.admin.updateUserById(user.id, { password })
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

    await adminClient
      .from('profiles')
      .update({ encrypted_password: encryptPassword(password) })
      .eq('id', user.id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
