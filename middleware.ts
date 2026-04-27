import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // STEP 1 — Public paths: never touch these
  const isPublic =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/signup' ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/favicon') ||
    /\.(.*)$/.test(pathname);

  if (isPublic) return NextResponse.next();

  // STEP 2 — Build Supabase client with proper cookie forwarding
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // STEP 3 — Get user (never use getSession — always getUser)
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // STEP 4 — Get profile (minimal fields only)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, is_banned, company_slug')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (profile.is_banned) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  const { role, company_slug } = profile;

  // STEP 5 — Role routing
  // SUPER ADMIN: must be on /admin
  if (role === 'super_admin') {
    if (!pathname.startsWith('/admin')) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // SUB ADMIN: must be on /sub-admin (but NOT /sub-admin/*/sales)
  if (role === 'sub_admin') {
    if (!pathname.startsWith('/sub-admin')) {
      const url = request.nextUrl.clone();
      url.pathname = company_slug
        ? `/sub-admin/${company_slug}`
        : '/login';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // SALES: allowed on /sub-admin/[slug]/sales/* and /sub-admin/[slug]/client/[id]
  if (role === 'sales') {
    const onSalesPath = /^\/sub-admin\/[^/]+\/sales(\/|$)/.test(pathname);
    const onClientPath = /^\/sub-admin\/[^/]+\/client\/[^/]+(\/|$)/.test(pathname);
    if (!onSalesPath && !onClientPath) {
      const url = request.nextUrl.clone();
      url.pathname = company_slug
        ? `/sub-admin/${company_slug}/sales`
        : '/login';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // TRADER: must be on /user
  if (role === 'trader') {
    if (!pathname.startsWith('/user')) {
      const url = request.nextUrl.clone();
      url.pathname = '/user';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Unknown role — let through
  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
