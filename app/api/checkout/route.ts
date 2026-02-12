import { NextResponse, NextRequest } from 'next/server';
import Stripe from 'stripe';

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Stripe secret key is not configured');
  }
  return new Stripe(secretKey);
}

interface CheckoutRequest {
  eventName?: string;
  eventDate?: string;
  totalPrice?: number;
  quantity?: number;
  eventId?: string;
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
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${eventName} - Ticket`,
              description: `Event: ${eventName} | Date: ${eventDate} | Qty: ${quantity}`,
              metadata: {
                eventName,
                eventDate,
                eventId,
              },
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
      },
    });

    // TODO: Store session ID in database
    // await db.orders.create({
    //   stripeSessionId: session.id,
    //   eventId,
    //   eventName,
    //   eventDate,
    //   quantity,
    //   totalPrice,
    //   status: 'pending',
    //   createdAt: new Date(),
    // });

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
