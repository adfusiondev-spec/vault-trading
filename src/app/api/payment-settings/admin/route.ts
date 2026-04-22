import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * GET /api/payment-settings/admin
 *
 * Returns the Master Admin's payment settings from the payment_settings table.
 * Used by Sub-Admins to display payment destination info in the
 * Subscription Payment modal.
 *
 * NOTE: This endpoint uses the service role key directly because sub-admins
 * can access the platform via localStorage impersonation (no real Supabase
 * cookie session), which makes cookie-based auth.getUser() return 401.
 * The data here (payment addresses) is semi-public info that any
 * authenticated sub-admin needs to know where to send their payment.
 *
 * Strategy: fetch ALL super_admin profile IDs, then return the most recently
 * updated payment_settings row belonging to any of them.
 */
export async function GET() {
  try {
    const adminClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Step 1: find all super_admin profile IDs
    const { data: adminProfiles, error: profileErr } = await adminClient
      .from('profiles')
      .select('id')
      .eq('role', 'super_admin')

    if (profileErr || !adminProfiles || adminProfiles.length === 0) {
      return NextResponse.json({ settings: null })
    }

    const adminIds = adminProfiles.map((p: { id: string }) => p.id)

    // Step 2: fetch the most recently updated payment settings row owned by any super_admin
    const { data: settings, error: settingsErr } = await adminClient
      .from('payment_settings')
      .select('*')
      .in('sub_admin_id', adminIds)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (settingsErr && settingsErr.code !== 'PGRST116') {
      return NextResponse.json({ error: settingsErr.message }, { status: 500 })
    }

    return NextResponse.json({ settings: settings ?? null })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

