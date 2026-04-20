import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    // Get the logged-in trader's session (cookie-based)
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ allowed_markets: null }, { status: 401 });
    }

    // Use service role to bypass RLS
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get trader's assigned_to
    const { data: trader } = await adminClient
      .from('profiles')
      .select('assigned_to')
      .eq('id', user.id)
      .single();

    if (!trader?.assigned_to) {
      return NextResponse.json({
        allowed_markets: ['crypto','forex','commodities','global_indices','saudi_indices']
      });
    }

    // Get sub-admin's allowed_markets
    const { data: subAdmin } = await adminClient
      .from('profiles')
      .select('allowed_markets')
      .eq('id', trader.assigned_to)
      .single();

    const markets = subAdmin?.allowed_markets?.length > 0
      ? subAdmin.allowed_markets
      : ['crypto','forex','commodities','global_indices','saudi_indices'];

    return NextResponse.json({ allowed_markets: markets });

  } catch (err) {
    return NextResponse.json({
      allowed_markets: ['crypto','forex','commodities','global_indices','saudi_indices']
    });
  }
}
