import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabaseClient';

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
      .select('id, payment_status')
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

      return NextResponse.json({ paid: true, updated: true, orderId: order.id });
    }

    // Already completed or completed_email_failed — nothing to do
    return NextResponse.json({ paid: true, updated: false, orderId: order.id });
  } catch (err) {
    console.error('Verify: stripe error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Verification failed' },
      { status: 500 }
    );
  }
}
