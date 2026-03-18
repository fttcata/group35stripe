import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '../../../../../../lib/supabaseClient';
import { canUserScanEvent, getAuthenticatedUserForRoute } from '@/lib/staffAccess';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const terminalCurrency = (process.env.STRIPE_TERMINAL_CURRENCY || 'eur').toLowerCase();

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const user = await getAuthenticatedUserForRoute();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!stripe) {
      return NextResponse.json(
        { error: 'STRIPE_SECRET_KEY is not configured' },
        { status: 500 }
      );
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { orderId } = await params;
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id,event_id,total_amount,payment_status,customer_email')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const allowed = await canUserScanEvent(order.event_id, user.id);
    if (!allowed) {
      return NextResponse.json({ error: 'You are not registered as staff for this event' }, { status: 403 });
    }

    if (order.payment_status === 'completed') {
      return NextResponse.json(
        { error: 'Order is already completed' },
        { status: 400 }
      );
    }

    const amountCents = Math.round(Number(order.total_amount) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return NextResponse.json({ error: 'Invalid order amount' }, { status: 400 });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: terminalCurrency,
      payment_method_types: ['card_present'],
      capture_method: 'automatic',
      metadata: {
        order_id: orderId,
      },
      receipt_email: order.customer_email || undefined,
    });

    return NextResponse.json({
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      amount: amountCents,
      currency: paymentIntent.currency,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create terminal payment intent' },
      { status: 500 }
    );
  }
}
