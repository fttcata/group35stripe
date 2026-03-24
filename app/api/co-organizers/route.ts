import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// GET: List co-organizers for an event
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const eventId = request.nextUrl.searchParams.get('eventId')
  if (!eventId) {
    return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })
  }

  const { data: coOrganizers, error } = await supabase
    .from('event_co_organizers')
    .select('id, user_id, status, created_at, updated_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch co-organizers' }, { status: 500 })
  }

  // Enrich with profile info
  const enriched = await Promise.all(
    (coOrganizers || []).map(async (co) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', co.user_id)
        .maybeSingle()

      return {
        ...co,
        email: profile?.email || 'Unknown',
        name: profile?.full_name || '',
      }
    })
  )

  return NextResponse.json({ coOrganizers: enriched })
}
