import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Create a server client for the middleware, using the request cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Update the request cookies
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          
          // Update the response cookies
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // This will refresh session if expired - required for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // حماية المسارات — إعادة توجيه غير المسجلين
  const protectedRoutes = ['/admin', '/sub-admin', '/user']
  const isProtected = protectedRoutes.some(r => path.startsWith(r))
  
  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // منع الوصول للمسارات الخاطئة حسب الدور
  if (user && isProtected) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_banned')
      .eq('id', user.id)
      .single()

    if (profile?.is_banned === true) {
      return NextResponse.redirect(new URL('/login?reason=banned', request.url))
    }

    const role = profile?.role
    const wrongRoute =
      (path.startsWith('/admin') && role !== 'super_admin') ||
      (path.startsWith('/sub-admin') && role !== 'sub_admin') ||
      (path.startsWith('/user') && role !== 'trader')

    if (wrongRoute) {
      // توجيه للمسار الصحيح
      if (role === 'super_admin') return NextResponse.redirect(new URL('/admin', request.url))
      if (role === 'sub_admin') return NextResponse.redirect(new URL('/sub-admin', request.url))
      if (role === 'trader') return NextResponse.redirect(new URL('/user', request.url))
    }
  }

  // منع الوصول لـ /login و /register إذا كان مسجلاً
  if (user && (path === '/login')) {
    const { data: profile } = await supabase
      .from('profiles').select('role, is_banned').eq('id', user.id).single()
    
    if (profile?.role === 'super_admin') return NextResponse.redirect(new URL('/admin', request.url))
    if (profile?.role === 'sub_admin') return NextResponse.redirect(new URL('/sub-admin', request.url))
    return NextResponse.redirect(new URL('/user', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/admin/:path*', '/sub-admin/:path*', '/user/:path*', '/login'],
}
