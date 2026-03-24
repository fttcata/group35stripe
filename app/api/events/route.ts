import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabaseClient'
import { createSupabaseServerClient } from '@/lib/supabase/server'

function isOrganizerRole(role: unknown): boolean {
  if (typeof role !== 'string') return false
  const normalized = role.trim().toLowerCase()
  return normalized === 'organizer' || normalized === 'organiser'
}

export async function GET() {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }
  try {
    const serverClient = await createSupabaseServerClient()
    const {
      data: { user },
    } = await serverClient.auth.getUser()

    let isOrganizer = false
    if (user?.id) {
      const { data: profile } = await serverClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      isOrganizer = isOrganizerRole(profile?.role || user.user_metadata?.role)
    }

    const baseQuery = supabase
      .from('events')
      .select('*')
      .eq('status', 'published')

    const scopedQuery = isOrganizer && user?.id
      ? baseQuery.eq('created_by', user.id)
      : baseQuery

    const { data, error } = await scopedQuery.order('start_date', { ascending: true })

    if (error) {
      console.error('Failed to fetch events:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ events: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
