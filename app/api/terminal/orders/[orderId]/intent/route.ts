import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '../../../../../../lib/supabaseClient';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const terminalCurrency = (process.env.STRIPE_TERMINAL_CURRENCY || 'eur').toLowerCase();

export async function POST(
  _req: NextRequest,
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

    const { orderId } = await params;
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id,total_amount,payment_status,customer_email,event_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
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

    let transferData: Stripe.PaymentIntentCreateParams.TransferData | undefined;
    let applicationFee: number | undefined;

    if (order.event_id) {
      const { data: eventRow } = await supabase
        .from('events')
        .select('created_by')
        .eq('id', order.event_id)
        .single();

      if (eventRow?.created_by) {
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('stripe_account_id')
          .eq('id', eventRow.created_by)
          .single();

        const destinationAccount = profileRow?.stripe_account_id?.trim();
        if (destinationAccount) {
          transferData = { destination: destinationAccount };
          const feePercent = Number(process.env.PLATFORM_FEE_PERCENT || 0);
          applicationFee = feePercent > 0
            ? Math.round(amountCents * (feePercent / 100))
            : undefined;
        }
      }
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
      ...(transferData ? { transfer_data: transferData } : {}),
      ...(applicationFee ? { application_fee_amount: applicationFee } : {}),
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
