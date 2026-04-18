import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { email, password, full_name, phone_number, country } = await request.json()

    // 1. Verify caller permissions
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
      
    if (!profile || (profile.role !== 'sub_admin' && profile.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Only administrators can create traders' }, { status: 403 })
    }

    // Determine the correct sub_admin ID to assign the trader to.
    // If the request includes an impersonated sub_admin ID (super_admin acting as sub_admin),
    // use that ID. Otherwise, use the caller's own ID (they are the sub_admin).
    const impersonatedId = request.headers.get('x-impersonated-id')
    const assignedToId = (profile.role === 'super_admin' && impersonatedId) ? impersonatedId : user.id

    // 2. Initialize Admin Client
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 3. Create User in Auth
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role: 'trader' }
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // 4. Update Profile with assigned_to and new fields
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({ 
        full_name,
        phone_number,
        country,
        assigned_to: assignedToId,
        role: 'trader'
      })
      .eq('id', authUser.user.id)

    if (profileError) {
      console.error('Profile update error:', profileError)
      // Attempt cleanup if profile update fails
      await adminClient.auth.admin.deleteUser(authUser.user.id)
      return NextResponse.json({ error: 'Failed to create trader profile' }, { status: 500 })
    }

    // 5. Initialize Wallet for the new trader
    const { error: walletError } = await adminClient
      .from('wallets')
      .insert({ 
        user_id: authUser.user.id,
        balance: 0 
      })

    if (walletError) {
      console.warn('Wallet initialization failed:', walletError.message)
      // We don't fail the whole request here, but maybe we should?
      // Actually, it's better to log it and let them fix it or have a trigger.
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Trader created successfully',
      trader: { id: authUser.user.id, email, full_name }
    })

  } catch (error: any) {
    console.error('Create-Trader Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
