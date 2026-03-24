import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import supabase from '@/lib/supabaseClient'
import { sendEventChangeEmail } from '@/lib/emailService'

// POST: Send notifications to all ticket holders when event details change
export async function POST(request: NextRequest) {
  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const { eventId, changes } = body

  if (!eventId || !changes) {
    return NextResponse.json({ error: 'Missing eventId or changes' }, { status: 400 })
  }

  // Verify the user is the organizer or co-organizer
  const { data: event } = await serverClient
    .from('events')
    .select('id, title, created_by, start_date, venue')
    .eq('id', eventId)
    .single()

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  // Check organizer access
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
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  // Find all ticket holders via orders (use service role client for cross-user data)
  if (!supabase) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 500 })
  }

  const { data: orders } = await supabase
    .from('orders')
    .select('user_id, customer_email')
    .eq('event_id', eventId)
    .in('payment_status', ['paid', 'completed'])

  if (!orders || orders.length === 0) {
    return NextResponse.json({ success: true, notified: 0 })
  }

  // Build notification message
  const changeParts: string[] = []
  if (changes.dateChanged) changeParts.push('date/time has been updated')
  if (changes.venueChanged) changeParts.push('venue has been changed')
  const changeText = changeParts.join(' and the ')
  const message = `The ${changeText} for "${event.title}". Please check the event page for the latest details.`

  // Deduplicate users
  const userIds = new Set<string>()
  const guestEmails = new Set<string>()

  for (const order of orders) {
    if (order.user_id) {
      userIds.add(order.user_id)
    } else if (order.customer_email) {
      guestEmails.add(order.customer_email)
    }
  }

  // Create in-app notifications for registered users
  const notificationRows = Array.from(userIds).map(userId => ({
    user_id: userId,
    type: 'event_update',
    title: `Event Update: ${event.title}`,
    message,
    link: `/events/${eventId}`,
    metadata: { event_id: eventId, changes },
  }))

  if (notificationRows.length > 0) {
    await supabase.from('notifications').insert(notificationRows)
  }

  // Send emails to all ticket holders (registered + guests)
  const allEmails = new Set<string>()

  // Get emails for registered users
  for (const userId of userIds) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .maybeSingle()
    if (profile?.email) allEmails.add(profile.email)
  }

  // Add guest emails
  for (const email of guestEmails) {
    allEmails.add(email)
  }

  // Send emails (non-blocking, don't fail the request)
  let emailsSent = 0
  for (const email of allEmails) {
    try {
      await sendEventChangeEmail({
        email,
        eventTitle: event.title,
        eventDate: event.start_date,
        eventVenue: event.venue,
        changes,
      })
      emailsSent++
    } catch (err) {
      console.error(`Failed to send notification email to ${email}:`, err)
    }
  }

  return NextResponse.json({
    success: true,
    notified: notificationRows.length,
    emailsSent,
  })
}
