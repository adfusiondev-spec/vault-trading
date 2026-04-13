import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'

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
  const { email, password, full_name, company_name, slug } = await request.json()
  
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
  const { error: roleError } = await adminClient
    .from('profiles')
    .update({ 
      role: 'sub_admin',
      assigned_to: user.id, // link to super_admin
      company_slug: slug
    })
    .eq('id', newUser.user.id)

  if (roleError) {
    return NextResponse.json({ error: roleError.message }, { status: 400 })
  }

  return NextResponse.json({ 
    success: true, 
    user_id: newUser.user.id,
    message: 'Tenant created successfully'
  })
}
