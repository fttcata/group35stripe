import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '../../../../../../lib/supabaseClient';
import { createTickets, getTicketsByOrderId } from '../../../../../../lib/ticketService';
import { sendTicketConfirmationEmail } from '../../../../../../lib/emailService';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

interface CompleteTerminalPaymentBody {
  paymentIntentId?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'STRIPE_SECRET_KEY is not configured' },
        { status: 500 }
      );
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const body: CompleteTerminalPaymentBody = await req.json().catch(() => ({}));
    if (!body.paymentIntentId) {
      return NextResponse.json({ error: 'paymentIntentId is required' }, { status: 400 });
    }

    const { orderId } = await params;
    const paymentIntent = await stripe.paymentIntents.retrieve(body.paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        { error: `Payment has not succeeded (current status: ${paymentIntent.status})` },
        { status: 400 }
      );
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id,event_id,customer_email,total_amount,payment_status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const { data: orderItems } = await supabase
      .from('order_items')
      .select('quantity')
      .eq('order_id', orderId);

    const quantity = (orderItems || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 1;

    let eventTitle = 'Event Ticket';
    let eventDate = new Date().toISOString();
    let eventVenue: string | undefined;
    let eventDescription: string | undefined;

    if (order.event_id) {
      const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .eq('id', order.event_id)
        .single();

      if (eventData) {
        eventTitle = String(eventData.title || eventTitle);
        eventDate = String(eventData.date || eventDate);
        eventVenue = eventData.venue || undefined;
        eventDescription = eventData.description || undefined;
      }
    }

    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({
        payment_status: 'completed',
        payment_method: 'stripe-terminal',
        stripe_session_id: body.paymentIntentId,
      })
      .eq('id', orderId);

    if (orderUpdateError) {
      return NextResponse.json(
        { error: `Failed to update order: ${orderUpdateError.message}` },
        { status: 500 }
      );
    }

    let tickets = await getTicketsByOrderId(orderId);
    if (tickets.length === 0) {
      tickets = await createTickets(orderId, eventTitle, 'Standard', quantity);
    }

    const usedAt = new Date().toISOString();
    const { error: checkInError } = await supabase
      .from('tickets')
      .update({
        is_used: true,
        used_at: usedAt,
      })
      .eq('order_id', orderId);

    if (checkInError) {
      return NextResponse.json(
        { error: `Payment complete, but failed to check in tickets: ${checkInError.message}` },
        { status: 500 }
      );
    }

    const checkedInTickets = tickets.map((ticket) => ({
      ...ticket,
      is_used: true,
    }));

    let receiptEmailMessageId: string | undefined;
    let receiptEmailError: string | undefined;

    if (order.customer_email) {
      const emailResult = await sendTicketConfirmationEmail({
        customer_email: order.customer_email,
        event_title: eventTitle,
        event_date: eventDate,
        event_venue: eventVenue,
        event_description: eventDescription,
        tickets: checkedInTickets,
        total_amount: Number(order.total_amount || 0),
        payment_method: 'stripe-terminal',
        order_id: orderId,
      });

      if (emailResult.success) {
        receiptEmailMessageId = emailResult.messageId;
      } else {
        receiptEmailError = emailResult.error;
      }
    }

    return NextResponse.json({
      success: true,
      orderId,
      paymentIntentId: body.paymentIntentId,
      checkedInCount: checkedInTickets.length,
      receiptEmailMessageId,
      receiptEmailError,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to complete terminal payment' },
      { status: 500 }
    );
  }
}
