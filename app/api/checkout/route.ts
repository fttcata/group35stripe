import { NextResponse, NextRequest } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '../../../lib/supabaseClient';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface CheckoutRequest {
  eventName?: string;
  eventDate?: string;
  totalPrice?: number;
  quantity?: number;
  eventId?: string;
  paymentMethod?: 'stripe' | 'pay-on-day';
  customerEmail?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: CheckoutRequest = await req.json().catch(() => ({}));
    
    // Get event details from request or use defaults
    const eventName = body.eventName || 'Event Ticket';
    const eventDate = body.eventDate || 'TBD';
    const totalPrice = body.totalPrice || 1000; // in cents ($10.00 default)
    const quantity = body.quantity || 1;
    const eventId = body.eventId || 'unknown';
    const eventIdForDb = UUID_REGEX.test(eventId) ? eventId : null;
    const paymentMethod = body.paymentMethod || 'stripe';
    const customerEmail = body.customerEmail;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: customerEmail,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${eventName} - Ticket`,
              description: `Event: ${eventName} | Date: ${eventDate} | Qty: ${quantity}`,
            },
            unit_amount: totalPrice,
          },
          quantity,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cancel`,
      metadata: {
        eventName,
        eventDate,
        eventId,
        quantity: quantity.toString(),
        paymentMethod,
      },
    });

    // Store pending order in database with session ID
    if (supabase) {
      const { error } = await supabase
        .from('orders')
        .insert([
          {
            stripe_session_id: session.id,
            event_id: eventIdForDb,
            customer_email: customerEmail || null,
            payment_method: paymentMethod,
            total_amount: totalPrice / 100,
            payment_status: 'pending',
          },
        ]);

      if (error) {
        console.warn('Failed to create pending order:', error);
        // Don't fail the checkout if we can't store the order - Stripe webhook will handle it
      }
    }

    return NextResponse.json({ 
      url: session.url,
      sessionId: session.id,
    });
  } catch (err: any) {
    console.error('Stripe checkout error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
