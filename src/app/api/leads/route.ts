import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const LEAD_STATUSES = [
  'New Prospect', 'Active', 'Hot Lead', 'Cold',
  'Prospect', 'Inactive', 'Contacted',
  'In Negotiation', 'Active / Funded',
]

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role, id, assigned_to').eq('id', user.id).single()

    let query = (supabase.from('leads') as any)
      .select('*, assigned_sales:profiles!leads_assigned_sales_id_fkey(id, full_name, email)')
      .order('created_at', { ascending: false })

    if ((profile as any)?.role === 'sub_admin') {
      query = query.eq('sub_admin_id', user.id)
    } else if ((profile as any)?.role === 'sales') {
      query = query.eq('assigned_sales_id', user.id)
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ leads: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role, id, assigned_to').eq('id', user.id).single()

    if (!['sub_admin', 'sales'].includes((profile as any)?.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { full_name, email, phone_number, country, status, notes, assigned_sales_id } = body

    if (!full_name) {
      return NextResponse.json({ error: 'full_name is required' }, { status: 400 })
    }

    const subAdminId = (profile as any).role === 'sub_admin'
      ? user.id : (profile as any).assigned_to

    const { data, error } = await (supabase.from('leads') as any).insert({
      sub_admin_id: subAdminId,
      assigned_sales_id: assigned_sales_id || ((profile as any).role === 'sales' ? user.id : null),
      full_name,
      email,
      phone_number,
      country,
      status: status || 'New Prospect',
      notes,
      source: 'manual',
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, lead: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role, assigned_to').eq('id', user.id).single()

    if (!['sub_admin', 'sales'].includes((profile as any)?.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { lead_id, status, notes, assigned_sales_id } = body

    if (!lead_id) return NextResponse.json({ error: 'lead_id required' }, { status: 400 })

    const updateData: any = { updated_at: new Date().toISOString() }

    if (status !== undefined) {
      const VALID = [
        'New Prospect', 'Active', 'Hot Lead', 'Cold',
        'Prospect', 'Inactive', 'Contacted',
        'In Negotiation', 'Active / Funded',
      ]
      if (!VALID.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      updateData.status = status
    }

    if (notes !== undefined) updateData.notes = notes

    if ('assigned_sales_id' in body) {
      updateData.assigned_sales_id = assigned_sales_id ?? null
    }

    // Use service role to bypass RLS — auth is already validated above
    const adminSupa = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await adminSupa
      .from('leads')
      .update(updateData)
      .eq('id', lead_id)
      .select()
      .single()

    if (error) {
      console.error('PATCH leads error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, lead: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
