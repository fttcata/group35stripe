import { NextResponse, NextRequest } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '../../../lib/supabaseClient';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// Check if Stripe is configured
if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY is not set - checkout will fail');
}

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

interface CheckoutRequest {
  eventName?: string;
  eventDate?: string;
  totalPrice?: number;
  quantity?: number;
  eventId?: string;
  items?: Array<{
    ticketTypeId?: string;
    name?: string;
    price?: number;
    quantity: number;
  }>;
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
    const eventIdMatch = eventId.match(UUID_REGEX);
    const eventIdForDb = eventIdMatch ? eventIdMatch[0] : null;
    const paymentMethod = body.paymentMethod || 'stripe';
    const customerEmail = body.customerEmail;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const items = (body.items || []).filter(item => Number(item.quantity) > 0);

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
    let paymentIntentData: Stripe.Checkout.SessionCreateParams.PaymentIntentData | undefined;

    if (supabase && eventIdForDb) {
      const { data: eventRow } = await supabase
        .from('events')
        .select('created_by')
        .eq('id', eventIdForDb)
        .single();

      if (eventRow?.created_by) {
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('stripe_account_id')
          .eq('id', eventRow.created_by)
          .single();

        const destinationAccount = profileRow?.stripe_account_id?.trim();
        if (destinationAccount) {
          const feePercent = Number(process.env.PLATFORM_FEE_PERCENT || 0);
          const applicationFee = feePercent > 0
            ? Math.round(totalPrice * (feePercent / 100))
            : undefined;

          paymentIntentData = {
            transfer_data: { destination: destinationAccount },
            ...(applicationFee ? { application_fee_amount: applicationFee } : {}),
          };
        }
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
      payment_intent_data: paymentIntentData,
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
      // Try to get the authenticated user's ID
      let userId: string | null = null;
      try {
        const authSupabase = await createSupabaseServerClient();
        const { data: { user } } = await authSupabase.auth.getUser();
        userId = user?.id ?? null;
      } catch {
        // Not authenticated - that's fine for guest checkout
      }

      const { error } = await supabase
        .from('orders')
        .insert([
          {
            stripe_session_id: session.id,
            event_id: eventIdForDb,
            user_id: userId,
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
      } else {
        const { data: orderRow } = await supabase
          .from('orders')
          .select('id')
          .eq('stripe_session_id', session.id)
          .single();

        if (orderRow?.id) {
          const orderItems = (items.length > 0 ? items : [{ quantity }]).map(item => ({
            order_id: orderRow.id,
            ticket_type_id: item.ticketTypeId || null,
            quantity: Math.max(1, Number(item.quantity) || 1),
          }));

          const { error: orderItemError } = await supabase
            .from('order_items')
            .insert(orderItems);

          if (orderItemError) {
            console.warn('Failed to create order items:', orderItemError);
          }
        }
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
