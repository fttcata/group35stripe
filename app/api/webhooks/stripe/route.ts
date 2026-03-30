import { NextResponse, NextRequest } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '../../../../lib/supabaseClient';
import { createTickets, getTicketsByOrderId } from '../../../../lib/ticketService';
import { sendTicketConfirmationEmail, TicketEmailData } from '../../../../lib/emailService';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates and returns the parsed webhook event from Stripe
 */
function getWebhookEvent(
  body: string,
  signature: string | null
): Stripe.Event {
  if (!signature) {
    throw new Error('Missing signature header');
  }

  try {
    return stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    throw new Error(`Webhook signature verification failed: ${err}`);
  }
}

/**
 * Handles a completed checkout session
 */
async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  console.log('Processing completed checkout session:', session.id);

  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const customerEmail = session.customer_details?.email;
    const customerName = session.customer_details?.name;

    if (!customerEmail) {
      throw new Error('Customer email not found in session');
    }

    // Get event and order metadata from session
    const eventId = session.metadata?.eventId;
    const eventName = session.metadata?.eventName;
    const eventDate = session.metadata?.eventDate;
    const quantity = parseInt(session.metadata?.quantity || '1');
    const eventIdForDb = eventId && UUID_REGEX.test(eventId) ? eventId : null;

    if (!eventName) {
      throw new Error('Missing event information in session metadata');
    }

    // Idempotent order handling without relying on DB ON CONFLICT constraints
    const { data: existingOrder, error: existingOrderError } = await supabase
      .from('orders')
      .select('id')
      .eq('stripe_session_id', session.id)
      .maybeSingle();

    if (existingOrderError) {
      throw new Error(`Failed to find existing order: ${existingOrderError.message}`);
    }

    let orderData: { id: string } | null = null;
    if (existingOrder?.id) {
      const { data: updatedOrder, error: updateError } = await supabase
        .from('orders')
        .update({
          event_id: eventIdForDb,
          customer_email: customerEmail,
          payment_method: 'stripe',
          total_amount: (session.amount_total || 0) / 100,
          payment_status: 'completed',
        })
        .eq('id', existingOrder.id)
        .select('id')
        .single();

      if (updateError || !updatedOrder) {
        throw new Error(`Failed to update order: ${updateError?.message}`);
      }
      orderData = updatedOrder;
    } else {
      const { data: insertedOrder, error: insertError } = await supabase
        .from('orders')
        .insert([
          {
            stripe_session_id: session.id,
            event_id: eventIdForDb,
            customer_email: customerEmail,
            payment_method: 'stripe',
            total_amount: (session.amount_total || 0) / 100,
            payment_status: 'completed',
          },
        ])
        .select('id')
        .single();

      if (insertError || !insertedOrder) {
        throw new Error(`Failed to create order: ${insertError?.message}`);
      }
      orderData = insertedOrder;
    }

    const orderId = orderData.id;
    console.log('Created order:', orderId);

    // Create tickets only if they do not already exist (idempotent retries)
    let tickets = await getTicketsByOrderId(orderId);
    if (tickets.length === 0) {
      tickets = await createTickets(orderId, eventName, 'Standard', quantity);
      console.log(`Created ${tickets.length} tickets for order ${orderId}`);
    } else {
      console.log(`Reusing ${tickets.length} existing tickets for order ${orderId}`);
    }

    // Fetch event details for email
    let eventData: { date?: string; venue?: string; description?: string } | null = null;
    if (eventIdForDb) {
      const { data, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventIdForDb)
        .single();

      if (eventError) {
        console.warn('Failed to fetch event details:', eventError);
      } else {
        eventData = data;
      }
    }

    // Send confirmation email
    const emailData: TicketEmailData = {
      customer_email: customerEmail,
      customer_name: customerName || undefined,
      event_title: eventName,
      event_date: eventDate || eventData?.date || new Date().toISOString(),
      event_venue: eventData?.venue || undefined,
      event_description: eventData?.description || undefined,
      tickets,
      total_amount: (session.amount_total || 0) / 100,
      payment_method: 'stripe',
      order_id: orderId,
    };

    const emailResult = await sendTicketConfirmationEmail(emailData);

    if (!emailResult.success) {
      console.error('Failed to send confirmation email:', emailResult.error);
      // Log this but don't fail the webhook - order was successfully created
      // Update the order status to indicate email failed
      await supabase
        .from('orders')
        .update({ payment_status: 'completed_email_failed' })
        .eq('id', orderId);
    } else {
      console.log('Confirmation email sent successfully:', emailResult.messageId);
    }
  } catch (error) {
    console.error('Error handling checkout session completed:', error);
    throw error;
  }
}

/**
 * Handles payment intent succeeded event
 */
async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  console.log('Processing payment intent:', paymentIntent.id);

  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    // Find order by payment intent ID stored in metadata or charges
    // This is a fallback if we're not using checkout sessions
    const { error } = await supabase
      .from('orders')
      .update({
        payment_status: 'completed',
      })
      .eq('stripe_session_id', paymentIntent.id)
      .select()
      .single();

    if (error) {
      console.warn('Order not found for payment intent:', paymentIntent.id);
    }
  } catch (error) {
    console.error('Error handling payment intent succeeded:', error);
    // Don't throw - this is an informational update
  }
}

export async function POST(req: NextRequest) {
  // Get the signature from headers
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  try {
    // Verify and parse the webhook event
    const event = getWebhookEvent(body, signature);

    console.log('Webhook event received:', event.type);

    // Handle specific event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'charge.refunded':
        console.log('Refund received - may need to handle refund emails', event.data.object);
        break;

      default:
        console.log('Unhandled webhook event type:', event.type);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Webhook error:', errorMessage);

    return NextResponse.json(
      {
        error: errorMessage,
        received: false,
      },
      { status: 400 }
    );
  }
}
