import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const email = user.email ?? '';

    // Fetch orders by user_id
    const { data: ordersByUser, error: err1 } = await supabase
      .from('orders')
      .select(
        `
        id,
        event_id,
        total_amount,
        payment_status,
        payment_method,
        created_at,
        events (
          id,
          title,
          description,
          start_date,
          venue,
          sport_category,
          images
        ),
        tickets (
          id,
          ticket_code,
          ticket_type,
          qr_code_data,
          is_used,
          used_at
        )
      `
      )
      .eq('user_id', user.id)
      .or('payment_status.in.(completed,completed_email_failed),payment_method.eq.pay-on-day')
      .order('created_at', { ascending: false });

    if (err1) {
      console.error('Failed to fetch purchases by user_id:', err1);
    }

    // Fetch orders by customer_email (covers guest checkouts before account creation)
    let ordersByEmail: typeof ordersByUser = [];
    if (email) {
      const { data, error: err2 } = await supabase
        .from('orders')
        .select(
          `
          id,
          event_id,
          total_amount,
          payment_status,
          payment_method,
          created_at,
          events (
            id,
            title,
            description,
            start_date,
            venue,
            sport_category,
            images
          ),
          tickets (
            id,
            ticket_code,
            ticket_type,
            qr_code_data,
            is_used,
            used_at
          )
        `
        )
        .eq('customer_email', email)
        .or('payment_status.in.(completed,completed_email_failed),payment_method.eq.pay-on-day')
        .order('created_at', { ascending: false });

      if (err2) {
        console.error('Failed to fetch purchases by email:', err2);
      }
      ordersByEmail = data || [];
    }

    // Merge and deduplicate by order id
    const all = [...(ordersByUser || []), ...(ordersByEmail || [])];
    const seen = new Set<string>();
    const unique = all.filter((o) => {
      if (seen.has(o.id)) return false;
      seen.add(o.id);
      return true;
    });

    // Sort newest first
    unique.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return NextResponse.json({ purchases: unique });
  } catch (error) {
    console.error('Error in purchases API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
