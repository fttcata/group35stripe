import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import supabase from '@/lib/supabaseClient'

// POST: Accept or decline a co-organizer invite
export async function POST(request: NextRequest) {
  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const { eventId, action } = body

  if (!eventId || !action || !['accept', 'decline'].includes(action)) {
    return NextResponse.json({ error: 'Missing eventId or invalid action (accept/decline)' }, { status: 400 })
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 500 })
  }

  // Find the pending invite
  const { data: invite } = await supabase
    .from('event_co_organizers')
    .select('id, event_id, invited_by')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (!invite) {
    return NextResponse.json({ error: 'No pending invite found' }, { status: 404 })
  }

  const newStatus = action === 'accept' ? 'accepted' : 'declined'

  const { error: updateError } = await supabase
    .from('event_co_organizers')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', invite.id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update invite' }, { status: 500 })
  }

  // If accepted, notify the original organizer
  if (action === 'accept') {
    const { data: event } = await supabase
      .from('events')
      .select('title')
      .eq('id', eventId)
      .single()

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle()

    const accepterName = profile?.full_name || profile?.email || 'A user'

    await supabase.from('notifications').insert({
      user_id: invite.invited_by,
      type: 'co_organizer_accepted',
      title: `Co-organizer accepted: ${event?.title || 'your event'}`,
      message: `${accepterName} has accepted the invitation to co-manage "${event?.title || 'your event'}".`,
      link: `/my-events/${eventId}/staff`,
      metadata: { event_id: eventId, accepted_by: user.id },
    })
  }

  return NextResponse.json({ success: true, status: newStatus })
}
