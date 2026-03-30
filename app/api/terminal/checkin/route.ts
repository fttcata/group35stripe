import { NextResponse, NextRequest } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';
import { canUserScanEvent, getAuthenticatedUserForRoute } from '@/lib/staffAccess';

// POST /api/terminal/checkin
// Marks a ticket as checked-in by its 6-digit check_in_code.
// Used when the ticket is already paid and only needs check-in.
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUserForRoute();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { checkInCode, selectedEventId } = await req.json();
    const code = String(checkInCode ?? '').trim();

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Invalid check-in code' }, { status: 400 });
    }

    if (!selectedEventId || typeof selectedEventId !== 'string') {
      return NextResponse.json({ error: 'Selected event is required' }, { status: 400 });
    }

    // Find the ticket and its order's event
    const { data: ticket, error: findError } = await supabase
      .from('tickets')
      .select('id, order_id, is_used')
      .eq('check_in_code', code)
      .single();

    if (findError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Look up the order to get event_id for authorization
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, event_id')
      .eq('id', ticket.order_id)
      .single();

    if (orderError || !order || !order.event_id) {
      return NextResponse.json({ error: 'Could not determine event for this ticket' }, { status: 400 });
    }

    const allowed = await canUserScanEvent(order.event_id, user.id);
    if (!allowed) {
      return NextResponse.json({ error: 'You are not registered as staff for this event' }, { status: 403 });
    }

    if (order.event_id !== selectedEventId) {
      return NextResponse.json({ error: 'This ticket belongs to a different event than the selected event' }, { status: 403 });
    }

    if (ticket.is_used) {
      return NextResponse.json({ error: 'Already checked in', alreadyUsed: true }, { status: 409 });
    }

    // Mark as used
    const usedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('tickets')
      .update({ is_used: true, used_at: usedAt })
      .eq('id', ticket.id);

    if (updateError) {
      return NextResponse.json({ error: `Failed to check in: ${updateError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, ticketId: ticket.id, orderId: ticket.order_id });
  } catch (err) {
    console.error('Check-in error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
