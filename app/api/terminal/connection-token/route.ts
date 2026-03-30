import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAuthenticatedUserForRoute } from '@/lib/staffAccess';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

export async function POST() {
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

    const connectionToken = await stripe.terminal.connectionTokens.create();
    return NextResponse.json({ secret: connectionToken.secret });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create connection token' },
      { status: 500 }
    );
  }
}
