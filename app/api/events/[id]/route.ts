import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Update event
    const { error: updateError } = await supabase
      .from('events')
      .update({
        title: body.title,
        description: body.description,
        start_date: body.start_date,
        end_time: body.end_time,
        sport_category: body.sport_category,
        venue: body.venue,
        location_url: body.location_url,
        images: body.images,
        status: body.status,
      })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      )
    }

    // Handle ticket types update
    if (body.ticketTypes && body.ticketTypes.length > 0) {
      // Delete old tickets
      const { error: deleteError } = await supabase
        .from('ticket_types')
        .delete()
        .eq('event_id', id)

      if (deleteError) {
        console.error('Error deleting old tickets:', deleteError)
      }

      // Insert new tickets
      const ticketRows = body.ticketTypes.map((ticket: any) => ({
        event_id: id,
        name: ticket.name,
        price: ticket.price,
      }))

      const { error: insertError } = await supabase
        .from('ticket_types')
        .insert(ticketRows)

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 400 }
        )
      }
    }

    // TODO: Send email notifications if date or venue changed and event is published
    // This would require fetching ticket holders and notifying them

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating event:', error)
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    )
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch event with ticket types
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single()

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    const { data: tickets } = await supabase
      .from('ticket_types')
      .select('*')
      .eq('event_id', id)

    return NextResponse.json({ event, tickets: tickets || [] })
  } catch (error) {
    console.error('Error fetching event:', error)
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    )
  }
}
