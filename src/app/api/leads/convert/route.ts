import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { encryptPassword } from '@/lib/crypto'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role, id, company_slug').eq('id', user.id).single()

    if (!['sub_admin', 'sales'].includes((profile as any)?.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { lead_id, password } = body

    if (!lead_id || !password) {
      return NextResponse.json({ error: 'lead_id and password required' }, { status: 400 })
    }

    const { data: lead, error: leadError } = await (supabase.from('leads') as any)
      .select('*').eq('id', lead_id).single()

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }
    if (!lead.email) {
      return NextResponse.json({ error: 'Lead must have an email to convert' }, { status: 400 })
    }
    if (lead.converted_to_trader_id) {
      return NextResponse.json({ error: 'Lead already converted' }, { status: 400 })
    }

    const adminSupa = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let subAdminId: string
    if ((profile as any).role === 'sub_admin') {
      subAdminId = user.id
    } else {
      const { data: sp } = await supabase
        .from('profiles').select('assigned_to').eq('id', user.id).single()
      subAdminId = (sp as any)?.assigned_to
    }

    const { data: newUser, error: createError } = await adminSupa.auth.admin.createUser({
      email: lead.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: lead.full_name },
    })

    if (createError || !newUser.user) {
      return NextResponse.json({ error: createError?.message }, { status: 500 })
    }

    // Wait for handle_new_user trigger to set defaults
    await new Promise(resolve => setTimeout(resolve, 500))

    await adminSupa.from('profiles').update({
      role: 'trader',
      assigned_to: subAdminId,
      assigned_sales_id: lead.assigned_sales_id,
      full_name: lead.full_name,
      phone_number: lead.phone_number,
      country: lead.country,
      is_active: false,
      lead_status: 'Inactive',
      encrypted_password: encryptPassword(password),
    }).eq('id', newUser.user.id)

    await adminSupa.from('leads').update({
      status: 'Active / Funded',
      converted_to_trader_id: newUser.user.id,
      updated_at: new Date().toISOString(),
    }).eq('id', lead_id)

    return NextResponse.json({
      success: true,
      trader_id: newUser.user.id,
      message: 'Lead successfully converted to trader',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
