import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import supabase from '@/lib/supabaseClient'
import { sendCoOrganizerInviteEmail } from '@/lib/emailService'

// POST: Invite a co-organizer by email
export async function POST(request: NextRequest) {
  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const { eventId, email } = body

  if (!eventId || !email) {
    return NextResponse.json({ error: 'Missing eventId or email' }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()

  // Verify the user owns this event
  const { data: event } = await serverClient
    .from('events')
    .select('id, title, created_by')
    .eq('id', eventId)
    .single()

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  // Check if user is the owner or an accepted co-organizer
  let isOrganizer = event.created_by === user.id
  if (!isOrganizer) {
    const { data: coOrg } = await serverClient
      .from('event_co_organizers')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .eq('status', 'accepted')
      .maybeSingle()
    isOrganizer = !!coOrg
  }

  if (!isOrganizer) {
    return NextResponse.json({ error: 'Only event organizers can invite co-organizers' }, { status: 403 })
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 500 })
  }

  // Find the invited user by email in profiles
  const { data: invitee } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (!invitee) {
    return NextResponse.json({ error: 'No account found with that email. They must have an account first.' }, { status: 404 })
  }

  if (invitee.role !== 'organizer' && invitee.role !== 'organiser') {
    return NextResponse.json({ error: 'That user is not an organizer account. Only organizers can be co-organizers.' }, { status: 400 })
  }

  if (invitee.id === user.id) {
    return NextResponse.json({ error: 'You cannot invite yourself' }, { status: 400 })
  }

  if (invitee.id === event.created_by) {
    return NextResponse.json({ error: 'That user is already the event owner' }, { status: 400 })
  }

  // Check if already invited
  const { data: existing } = await supabase
    .from('event_co_organizers')
    .select('id, status')
    .eq('event_id', eventId)
    .eq('user_id', invitee.id)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'accepted') {
      return NextResponse.json({ error: 'This user is already a co-organizer' }, { status: 400 })
    }
    if (existing.status === 'pending') {
      return NextResponse.json({ error: 'An invite is already pending for this user' }, { status: 400 })
    }
    // If declined, allow re-invite by updating
    await supabase
      .from('event_co_organizers')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', existing.id)
  } else {
    // Create new invite
    const { error: insertError } = await supabase
      .from('event_co_organizers')
      .insert({
        event_id: eventId,
        user_id: invitee.id,
        invited_by: user.id,
        status: 'pending',
      })

    if (insertError) {
      console.error('Failed to create co-organizer invite:', insertError)
      return NextResponse.json({ error: 'Failed to send invite' }, { status: 500 })
    }
  }

  // Create notification for the invitee
  await supabase.from('notifications').insert({
    user_id: invitee.id,
    type: 'co_organizer_invite',
    title: `Co-organizer invite: ${event.title}`,
    message: `You have been invited to co-manage "${event.title}". Go to your notifications to accept or decline.`,
    link: '/notifications',
    metadata: { event_id: eventId, invited_by: user.id },
  })

  // Send email notification
  try {
    const { data: inviterProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()

    await sendCoOrganizerInviteEmail({
      email: normalizedEmail,
      eventTitle: event.title,
      inviterName: inviterProfile?.full_name || user.email || 'An organizer',
    })
  } catch (err) {
    console.error('Failed to send co-organizer invite email:', err)
  }

  return NextResponse.json({ success: true, inviteeEmail: normalizedEmail })
}
