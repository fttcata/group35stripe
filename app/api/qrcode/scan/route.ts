import { NextResponse, NextRequest } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';
import { canUserScanEvent, getAuthenticatedUserForRoute } from '@/lib/staffAccess';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUserForRoute();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ticketCode, eventTitleHint, selectedEventId } = await req.json();
    if (!selectedEventId || typeof selectedEventId !== 'string') {
      return NextResponse.json({ error: 'Selected event is required' }, { status: 400 });
    }


    if (!ticketCode || typeof ticketCode !== 'string') {
      return NextResponse.json(
        { error: 'Invalid ticket code' },
        { status: 400 }
      );
    }

    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Look up ticket by ticket_code
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id, order_id, is_used')
      .eq('ticket_code', ticketCode)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        customer_email,
        guest_name,
        payment_status,
        total_amount,
        event_id,
        tickets (
          id,
          is_used
        )
      `)
      .eq('id', ticket.order_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    let resolvedEventId: string | null = order.event_id ?? null;

    if (!resolvedEventId && eventTitleHint && typeof eventTitleHint === 'string') {
      const hint = eventTitleHint.trim();
      if (hint) {
        const { data: hintedEvent } = await supabase
          .from('events')
          .select('id')
          .eq('title', hint)
          .limit(1)
          .maybeSingle();

        if (hintedEvent?.id) {
          resolvedEventId = hintedEvent.id;

          // Backfill legacy/malformed orders so future scans authorize cleanly.
          await supabase
            .from('orders')
            .update({ event_id: hintedEvent.id })
            .eq('id', order.id);
        }
      }
    }

    if (!resolvedEventId) {
      return NextResponse.json({ error: 'Could not determine event for this ticket' }, { status: 400 });
    }

    const allowed = await canUserScanEvent(resolvedEventId, user.id);
    if (!allowed) {
      return NextResponse.json({ error: 'You are not registered as staff for this event' }, { status: 403 });
    }

    if (!resolvedEventId || resolvedEventId !== selectedEventId) {
      return NextResponse.json({ error: 'This ticket is for a different event than the one currently selected' }, { status: 403 });
    }

    // Get event title
    let eventTitle = 'Event';
    if (resolvedEventId) {
      const { data: event } = await supabase
        .from('events')
        .select('title')
        .eq('id', resolvedEventId)
        .single();

      if (event) eventTitle = event.title;
    }

    const isPaid = order.payment_status === 'completed' || order.payment_status === 'paid';
    const customerName = order.guest_name || order.customer_email?.split('@')[0] || 'Customer';

    return NextResponse.json({
      ticketCode,
      orderId: order.id,
      eventId: resolvedEventId,
      customerName,
      eventTitle,
      paymentStatus: order.payment_status,
      totalAmount: order.total_amount || 0,
      isPaid,
      tickets: order.tickets || [],
    });
  } catch (error) {
    console.error('QR scan error:', error);
    return NextResponse.json(
      { error: 'Failed to process QR code' },
      { status: 500 }
    );
  }
}
