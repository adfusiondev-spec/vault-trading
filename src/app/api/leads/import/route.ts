import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role, id').eq('id', user.id).single()

    if ((profile as any)?.role !== 'sub_admin') {
      return NextResponse.json({ error: 'Only sub_admin can import leads' }, { status: 403 })
    }

    const body = await req.json()
    const { leads, assigned_sales_id } = body

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'No leads provided' }, { status: 400 })
    }

    const toInsert = leads.map((lead: any) => ({
      sub_admin_id: user.id,
      assigned_sales_id: assigned_sales_id || null,
      full_name: lead.full_name || lead['Full Name'] || lead['Nom Complet'] || 'Unknown',
      email: lead.email || lead['Email'] || null,
      phone_number: lead.phone_number || lead['Phone'] || lead['Téléphone'] || null,
      country: lead.country || lead['Country'] || lead['Pays'] || null,
      status: 'New Prospect',
      source: 'import',
    }))

    const { data, error } = await (supabase.from('leads') as any).insert(toInsert).select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      imported: data?.length || 0,
      leads: data,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
