import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '../../../../../lib/supabaseClient';

export const runtime = 'nodejs';

type OrderRow = {
  id: string;
  total_amount: number;
  payment_status: string;
  payment_method: string | null;
  created_at: string;
  customer_email: string | null;
  stripe_session_id?: string | null;
  payment_intent_id?: string | null;
  charge_id?: string | null;
};

type OrderItemRow = {
  order_id: string;
  quantity: number;
  ticket_type_id: string | null;
  ticket_types?: { name: string; price: number } | null;
};

const COMPLETED_STATUSES = new Set(['completed', 'completed_email_failed']);
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

function isPayOnDay(method?: string | null) {
  return method === 'pay-on-day' || method === 'stripe-terminal';
}

async function resolveChargeId(order: OrderRow): Promise<string | null> {
  if (!stripe) return null;
  if (order.charge_id) return order.charge_id;

  let paymentIntentId = order.payment_intent_id || null;
  if (!paymentIntentId && order.stripe_session_id) {
    if (order.stripe_session_id.startsWith('pi_')) {
      paymentIntentId = order.stripe_session_id;
    } else if (order.stripe_session_id.startsWith('cs_')) {
      const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id, {
        expand: ['payment_intent'],
      });
      if (typeof session.payment_intent === 'string') {
        paymentIntentId = session.payment_intent;
      } else if (session.payment_intent?.id) {
        paymentIntentId = session.payment_intent.id;
      }
    }
  }

  if (!paymentIntentId) return null;

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (typeof paymentIntent.latest_charge === 'string') {
    return paymentIntent.latest_charge;
  }
  if (paymentIntent.latest_charge?.id) {
    return paymentIntent.latest_charge.id;
  }
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
    }

    const { id } = await params;

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .eq('event_id', id)
      .order('created_at', { ascending: false });

    if (ordersError) {
      return NextResponse.json({ error: ordersError.message }, { status: 500 });
    }

    const allOrders = (orders || []) as OrderRow[];
    const completedOrders = allOrders.filter((order) => COMPLETED_STATUSES.has(order.payment_status));

    const totals = completedOrders.reduce(
      (acc, order) => {
        const amount = Number(order.total_amount || 0);
        acc.completedRevenue += amount;
        if (isPayOnDay(order.payment_method)) {
          acc.payOnDayRevenue += amount;
        } else {
          acc.payNowRevenue += amount;
        }
        return acc;
      },
      { completedRevenue: 0, payNowRevenue: 0, payOnDayRevenue: 0 }
    );

    const deferredRevenue = allOrders.reduce((sum, order) => {
      if (order.payment_status === 'pending' && isPayOnDay(order.payment_method)) {
        return sum + Number(order.total_amount || 0);
      }
      return sum;
    }, 0);

    let stripeFeesTotal = 0;
    let netRevenue = totals.completedRevenue;

    if (stripe && completedOrders.length > 0) {
      netRevenue = 0;
      for (const order of completedOrders) {
        const grossAmount = Number(order.total_amount || 0);
        if (isPayOnDay(order.payment_method)) {
          netRevenue += grossAmount;
          continue;
        }

        try {
          const chargeId = await resolveChargeId(order);
          if (!chargeId) {
            netRevenue += grossAmount;
            continue;
          }
          const charge = await stripe.charges.retrieve(chargeId);
          if (!charge.balance_transaction) {
            netRevenue += grossAmount;
            continue;
          }
          const balanceTxId = typeof charge.balance_transaction === 'string'
            ? charge.balance_transaction
            : charge.balance_transaction.id;
          const balanceTx = await stripe.balanceTransactions.retrieve(balanceTxId);
          const fee = (balanceTx.fee || 0) / 100;
          const net = (balanceTx.net || 0) / 100;
          stripeFeesTotal += fee;
          netRevenue += net;
        } catch {
          netRevenue += grossAmount;
        }
      }
    }

    const payMethodBreakdown = allOrders.reduce(
      (acc, order) => {
        if (isPayOnDay(order.payment_method)) acc.payOnDayCount += 1;
        else acc.payNowCount += 1;
        return acc;
      },
      { payNowCount: 0, payOnDayCount: 0 }
    );

    const completedOrderIds = completedOrders.map((order) => order.id);
    let orderItems: OrderItemRow[] = [];

    if (completedOrderIds.length > 0) {
      const { data: itemRows, error: itemsError } = await supabase
        .from('order_items')
        .select('order_id,quantity,ticket_type_id,ticket_types(name,price)')
        .in('order_id', completedOrderIds);

      if (itemsError) {
        return NextResponse.json({ error: itemsError.message }, { status: 500 });
      }

      orderItems = (itemRows || []) as unknown as OrderItemRow[];
    }

    const revenueByTypeMap = new Map<string, { ticket_type: string; sold: number; revenue: number }>();
    for (const item of orderItems) {
      const name = item.ticket_types?.name || 'Unknown';
      const price = Number(item.ticket_types?.price || 0);
      const quantity = Number(item.quantity || 0);
      const current = revenueByTypeMap.get(name) || { ticket_type: name, sold: 0, revenue: 0 };
      current.sold += quantity;
      current.revenue += quantity * price;
      revenueByTypeMap.set(name, current);
    }

    const revenueByType = Array.from(revenueByTypeMap.values()).sort((a, b) => b.revenue - a.revenue);

    const orderCreatedAtMap = new Map<string, string>();
    for (const order of completedOrders) {
      const dateKey = new Date(order.created_at).toISOString().slice(0, 10);
      orderCreatedAtMap.set(order.id, dateKey);
    }

    const timelineMap = new Map<string, number>();
    for (const item of orderItems) {
      const dateKey = orderCreatedAtMap.get(item.order_id);
      if (!dateKey) continue;
      const current = timelineMap.get(dateKey) || 0;
      timelineMap.set(dateKey, current + Number(item.quantity || 0));
    }

    const salesTimeline = Array.from(timelineMap.entries())
      .map(([date, tickets_sold]) => ({ date, tickets_sold }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const recentTransactions = allOrders.slice(0, 8);

    return NextResponse.json({
      totals: { ...totals, deferredRevenue, stripeFeesTotal, netRevenue },
      revenueByType,
      salesTimeline,
      payMethodBreakdown,
      recentTransactions,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load sales analytics' },
      { status: 500 }
    );
  }
}
