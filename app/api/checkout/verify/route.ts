import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabaseClient';
import { createTickets, getTicketsByOrderId } from '@/lib/ticketService';
import { sendTicketConfirmationEmail, TicketEmailData } from '@/lib/emailService';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

/**
 * GET /api/checkout/verify?session_id=xxx
 *
 * Fallback for when the Stripe webhook is delayed or hasn't fired yet.
 * Retrieves the session from Stripe and marks the DB order as 'completed'
 * if Stripe confirms the payment.  Called automatically from the success page.
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
  }

  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const isPaid =
      session.payment_status === 'paid' && session.status === 'complete';

    if (!isPaid) {
      return NextResponse.json({ paid: false, status: session.payment_status });
    }

    // Find the order and update to 'completed' if still pending
    const { data: order, error: findError } = await supabase
      .from('orders')
      .select('id, payment_status, customer_email')
      .eq('stripe_session_id', sessionId)
      .maybeSingle();

    if (findError) {
      console.error('Verify: failed to find order:', findError.message);
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }

    if (!order) {
      // Order may not exist yet if the webhook hasn't run — nothing to update
      return NextResponse.json({ paid: true, updated: false });
    }

    if (order.payment_status === 'pending') {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ payment_status: 'completed' })
        .eq('id', order.id);

      if (updateError) {
        console.error('Verify: failed to update order:', updateError.message);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    // Create tickets if they don't already exist (webhook may not have fired yet)
    let tickets = await getTicketsByOrderId(order.id);
    if (tickets.length === 0) {
      const eventName = session.metadata?.eventName || 'Event Ticket';
      const quantity = parseInt(session.metadata?.quantity || '1');

      const { data: orderItems } = await supabase
        .from('order_items')
        .select('quantity,ticket_type_id,ticket_types(name)')
        .eq('order_id', order.id);

      if (orderItems && orderItems.length > 0) {
        for (const item of orderItems) {
          const qty = Math.max(1, Number(item.quantity) || 1);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ticketTypesObj = item.ticket_types as any;
          const ticketTypeName = ticketTypesObj?.name || (Array.isArray(ticketTypesObj) ? ticketTypesObj[0]?.name : undefined) || 'Standard';
          const created = await createTickets(order.id, eventName, ticketTypeName, qty);
          tickets.push(...created);
        }
      } else {
        tickets = await createTickets(order.id, eventName, 'Standard', quantity);
      }

      // Send confirmation email since we just created the tickets
      const customerEmail = order.customer_email || session.customer_details?.email;
      if (customerEmail && tickets.length > 0) {
        const eventId = session.metadata?.eventId;
        const eventDate = session.metadata?.eventDate;
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const eventIdForDb = eventId && UUID_REGEX.test(eventId) ? eventId : null;

        let eventData: { date?: string; venue?: string; description?: string } | null = null;
        if (eventIdForDb) {
          const { data } = await supabase
            .from('events')
            .select('*')
            .eq('id', eventIdForDb)
            .single();
          eventData = data;
        }

        const emailData: TicketEmailData = {
          customer_email: customerEmail,
          customer_name: session.customer_details?.name || undefined,
          event_title: eventName,
          event_date: eventDate || eventData?.date || new Date().toISOString(),
          event_venue: eventData?.venue || undefined,
          event_description: eventData?.description || undefined,
          tickets,
          total_amount: (session.amount_total || 0) / 100,
          payment_method: 'stripe',
          order_id: order.id,
        };

        const emailResult = await sendTicketConfirmationEmail(emailData);
        if (!emailResult.success) {
          console.error('Verify: failed to send confirmation email:', emailResult.error);
        }
      }
    }

    return NextResponse.json({ paid: true, updated: order.payment_status === 'pending', orderId: order.id });
  } catch (err) {
    console.error('Verify: stripe error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Verification failed' },
      { status: 500 }
    );
  }
}
