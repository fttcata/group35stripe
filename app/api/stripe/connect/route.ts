import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(_req: NextRequest) {
  try {
    if (!stripeSecretKey) {
      return NextResponse.json({ error: 'STRIPE_SECRET_KEY is not configured' }, { status: 500 });
    }
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const authSupabase = await createSupabaseServerClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('id, role, stripe_account_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (profile.role !== 'organizer') {
      return NextResponse.json({ error: 'Only organizers can connect Stripe' }, { status: 403 });
    }

    const stripe = new Stripe(stripeSecretKey);
    let accountId = profile.stripe_account_id?.trim() || '';

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email || undefined,
        metadata: {
          user_id: user.id,
        },
      });

      accountId = account.id;

      await adminSupabase
        .from('profiles')
        .update({ stripe_account_id: accountId })
        .eq('id', user.id);
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/account?stripe=refresh`,
      return_url: `${baseUrl}/account?stripe=connected`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url, accountId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start Stripe Connect' },
      { status: 500 }
    );
  }
}
