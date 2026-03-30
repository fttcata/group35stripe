import { NextResponse, NextRequest } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '../../../lib/supabaseClient';

// Check if Stripe is configured
if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY is not set - checkout will fail');
}

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface CheckoutRequest {
  eventName?: string;
  eventDate?: string;
  totalPrice?: number;
  quantity?: number;
  eventId?: string;
  // Guest checkout fields
  isGuest?: boolean;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  paymentMethod?: 'stripe' | 'pay-on-day';
  customerEmail?: string;
}

export async function POST(req: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!stripe) {
      return NextResponse.json(
        { error: 'Payment processing is not configured. Please set STRIPE_SECRET_KEY.' },
        { status: 500 }
      );
    }

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

    // Guest checkout info
    const isGuest = body.isGuest ?? true; // Default to guest checkout
    const guestName = body.guestName?.trim() || '';
    const guestEmail = body.guestEmail?.trim().toLowerCase() || '';
    const guestPhone = body.guestPhone?.trim() || null;

    // Validate guest email if provided
    if (isGuest && guestEmail) {
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      if (!emailRegex.test(guestEmail)) {
        return NextResponse.json(
          { error: 'Invalid email address' },
          { status: 400 }
        );
      }
    }
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: guestEmail || customerEmail || undefined,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${eventName} - Ticket${quantity > 1 ? 's' : ''}`,
              description: `Event: ${eventName} | Date: ${eventDate} | Qty: ${quantity}`,
            },
            // totalPrice is already the total amount, so use quantity=1
            unit_amount: totalPrice,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}&guest=true`,
      cancel_url: `${baseUrl}/cancel`,
      metadata: {
        eventName,
        eventDate,
        eventId,
        quantity: quantity.toString(),
        isGuest: isGuest.toString(),
        guestName,
        guestEmail,
        guestPhone: guestPhone || '',
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
            customer_email: guestEmail || customerEmail || null,
            payment_method: paymentMethod,
            total_amount: totalPrice / 100,
            payment_status: 'pending',
            is_guest: isGuest,
            guest_name: guestName || null,
            guest_email: guestEmail || null,
            guest_phone: guestPhone,
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
  } catch (err: unknown) {
    console.error('Stripe checkout error:', err);
    const message = err instanceof Error ? err.message : 'Failed to create checkout session';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
