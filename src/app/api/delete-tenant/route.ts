import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  console.log('API: delete-tenant reached')
  // 1. Verify the caller is a super_admin
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  if (user.email !== 'admin@thevault.io') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
      
    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden. You do not have super_admin privileges.' }, { status: 403 })
    }
  }

  // 2. Delete the tenant user using service role
  const { tenant_id } = await request.json()
  
  if (!tenant_id) {
    return NextResponse.json({ error: 'Missing tenant ID' }, { status: 400 })
  }

  // Skip actual DB deletion for mock local tenants (T-001, etc)
  if (tenant_id.startsWith('T-')) {
    return NextResponse.json({ success: true, message: 'Mock tenant deleted' })
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Try to delete from Auth
  const { error } = await adminClient.auth.admin.deleteUser(tenant_id)

  if (error) {
    // If user is already gone from Auth, we still want to return success 
    // so the frontend can remove the stale record from LocalStorage.
    if (error.message.includes('User not found') || error.message.includes('not found')) {
      return NextResponse.json({ 
        success: true, 
        message: 'Tenant was not found in Auth, but local record can be cleared.' 
      })
    }

    console.error('Supabase Auth Delete Error:', error)
    return NextResponse.json({ 
      error: error.message,
      code: (error as any).code || 'auth_error',
      details: 'Check if this user has processed transactions. You may need to run the SQL migration.'
    }, { status: 400 })
  }

  return NextResponse.json({ 
    success: true, 
    message: 'Tenant deleted successfully'
  })
}
