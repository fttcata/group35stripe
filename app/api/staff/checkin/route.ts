import { NextResponse, NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

interface CheckInRequest {
  orderId: string
  staffNotes?: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as CheckInRequest
    const { orderId } = body

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, event_id, customer_email, guest_email, payment_status, tickets (id, is_used)')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const tickets = order.tickets || []
    const unCheckedInTickets = tickets.filter((t: any) => !t.is_used)

    if (unCheckedInTickets.length === 0) {
      return NextResponse.json({
        success: true,
        checkedInCount: 0,
        message: 'All tickets already checked in',
      })
    }

    const now = new Date().toISOString()
    const ticketIds = unCheckedInTickets.map((t: any) => t.id)

    const { error: updateError } = await supabase
      .from('tickets')
      .update({
        is_used: true,
        used_at: now,
      })
      .in('id', ticketIds)

    if (updateError) {
      console.error('Ticket check-in error:', updateError)
      return NextResponse.json({ error: 'Failed to check in tickets' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      checkedInCount: unCheckedInTickets.length,
      message: `Checked in ${unCheckedInTickets.length} ticket(s)`,
    })
  } catch (error) {
    console.error('Staff check-in error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
