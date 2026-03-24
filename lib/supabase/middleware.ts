import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function isOrganizerRole(role: unknown) {
  if (typeof role !== 'string') return false
  const normalized = role.trim().toLowerCase()
  return normalized === 'organizer' || normalized === 'organiser'
}

// Check if Supabase is configured
const isSupabaseConfigured = () => {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Skip Supabase auth if not configured (for local testing)
  if (!isSupabaseConfigured()) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
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

  // Refresh the auth token
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let organizerUser = false
  if (user?.id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    organizerUser = isOrganizerRole(profile?.role || user.user_metadata?.role)
  }

  // Protected routes — redirect to login if not authenticated
  const protectedPaths = ['/submit-event', '/account', '/staff', '/organizer']
  const isProtected = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // Redirect logged-in users away from auth pages
  const authPaths = ['/login', '/register']
  const isAuthPage = authPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (isAuthPage && user) {
    const url = request.nextUrl.clone()
    url.pathname = organizerUser ? '/organizer' : '/'
    return NextResponse.redirect(url)
  }

  // Organizer users should operate from the command center instead of attendee discovery/purchase flows.
  const attendeeOnlyPaths = ['/', '/events', '/eventDetails', '/buy', '/purchases/history']
  const isAttendeeOnlyPath = attendeeOnlyPaths.some((path) =>
    path === '/'
      ? request.nextUrl.pathname === '/'
      : request.nextUrl.pathname.startsWith(path)
  )

  if (organizerUser && isAttendeeOnlyPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/organizer'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
