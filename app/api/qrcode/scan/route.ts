import { NextResponse, NextRequest } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

export async function POST(req: NextRequest) {
  try {
    const { ticketCode } = await req.json();

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

    // Get event title
    let eventTitle = 'Event';
    if (order.event_id) {
      const { data: event } = await supabase
        .from('events')
        .select('title')
        .eq('id', order.event_id)
        .single();

      if (event) eventTitle = event.title;
    }

    const isPaid = order.payment_status === 'completed' || order.payment_status === 'paid';
    const customerName = order.guest_name || order.customer_email?.split('@')[0] || 'Customer';

    return NextResponse.json({
      ticketCode,
      orderId: order.id,
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
