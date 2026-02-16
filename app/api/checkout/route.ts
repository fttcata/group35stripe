import { NextResponse, NextRequest } from 'next/server';
import Stripe from 'stripe';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// Check if Stripe is configured
if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY is not set - checkout will fail');
}

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

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
      customer_email: guestEmail || undefined, // Pre-fill email in Stripe checkout
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${eventName} - Ticket${quantity > 1 ? 's' : ''}`,
              description: `Event: ${eventName} | Date: ${eventDate} | Qty: ${quantity}`,
              metadata: {
                eventName,
                eventDate,
                eventId,
              },
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
      },
    });

    // Store order in database with guest flag (only if Supabase is configured)
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      try {
        const supabase = await createSupabaseServerClient();
        
        await supabase.from('orders').insert({
          event_id: eventId !== 'unknown' ? eventId : null,
          total_amount: totalPrice / 100, // Convert cents to dollars
          payment_status: 'pending',
          stripe_session_id: session.id,
          is_guest: isGuest,
          guest_name: guestName || null,
          guest_email: guestEmail || null,
          guest_phone: guestPhone,
          user_id: null, // Guest checkout has no user
        });
      } catch (dbError) {
        // Log but don't fail - order can be created via webhook
        console.warn('Failed to store order in database:', dbError);
      }
    } else {
      console.log('Supabase not configured - skipping database insert (local testing mode)');
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
