import { NextResponse, NextRequest } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';

export async function POST(req: NextRequest) {
  try {
    const { email, orderId } = await req.json();

    if (!email && !orderId) {
      return NextResponse.json(
        { error: 'Email or order ID is required' },
        { status: 400 }
      );
    }

    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    let query = supabase.from('orders').select(`
      id,
      event_id,
      total_amount,
      payment_status,
      created_at,
      events (
        id,
        title,
        description,
        date,
        venue
      ),
      tickets (
        id,
        ticket_code,
        ticket_type,
        qr_code_data,
        is_used
      )
    `);

    // Filter by email or order ID
    if (orderId) {
      query = query.eq('id', orderId);
    } else if (email) {
      query = query.eq('customer_email', email);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch order:', error);
      return NextResponse.json(
        { error: 'Failed to retrieve tickets' },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        {
          tickets: [],
          event: null,
          message: 'No tickets found for the provided information',
        },
        { status: 404 }
      );
    }

    // Return first matching order with all its tickets
    const order = data[0];
    const event = (order as any).events;
    const tickets = (order as any).tickets || [];

    return NextResponse.json({
      orderId: order.id,
      event,
      tickets,
      paymentStatus: order.payment_status,
      totalAmount: order.total_amount,
    });
  } catch (error) {
    console.error('Error retrieving tickets:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  // Support GET requests for accessibility
  const email = req.nextUrl.searchParams.get('email');
  const orderId = req.nextUrl.searchParams.get('orderId');

  const reqBody = new Request(req);
  const body = JSON.stringify({ email, orderId });

  return POST(
    new NextRequest(req.nextUrl, {
      method: 'POST',
      body,
      headers: req.headers,
    })
  );
}
