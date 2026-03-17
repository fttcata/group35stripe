import { NextResponse, NextRequest } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';

function generateCheckInCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function backfillTicketCodes(tickets: Array<Record<string, unknown>>): Promise<Array<Record<string, unknown>>> {
  if (!supabase) return tickets;
  const result = [...tickets];
  for (let i = 0; i < result.length; i++) {
    if (!result[i].check_in_code) {
      const code = generateCheckInCode();
      const { error } = await supabase
        .from('tickets')
        .update({ check_in_code: code })
        .eq('id', result[i].id);
      if (!error) {
        result[i] = { ...result[i], check_in_code: code };
      }
    }
  }
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const { email, orderId, checkInCode } = await req.json();

    if (!email && !orderId && !checkInCode) {
      return NextResponse.json(
        { error: 'Email, order ID, or check-in code is required' },
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
      tickets (
        id,
        ticket_code,
        check_in_code,
        ticket_type,
        qr_code_data,
        is_used
      )
    `);

    // If looking up by check-in code, find the ticket first then get its order
    if (checkInCode) {
      const code = String(checkInCode).trim();
      if (!/^\d{6}$/.test(code)) {
        return NextResponse.json(
          { error: 'Check-in code must be a 6-digit number' },
          { status: 400 }
        );
      }
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .select('order_id')
        .eq('check_in_code', code)
        .single();

      if (ticketError || !ticket) {
        return NextResponse.json(
          { tickets: [], event: null, message: 'No ticket found for this check-in code' },
          { status: 404 }
        );
      }
      query = query.eq('id', ticket.order_id);
    } else if (orderId) {
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
    const rawTickets = ((order as Record<string, unknown>).tickets as Array<Record<string, unknown>>) || [];
    const tickets = await backfillTicketCodes(rawTickets);

    let event: Record<string, unknown> | null = null;
    if (order.event_id) {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', order.event_id)
        .single();

      if (eventError) {
        console.warn('Failed to fetch event details for tickets endpoint:', eventError);
      } else if (eventData) {
        event = {
          id: eventData.id,
          title: eventData.title,
          description: eventData.description,
          date: eventData.date || eventData.start_date || null,
          venue: eventData.venue || eventData.location || null,
        };
      }
    }

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
  const checkInCode = req.nextUrl.searchParams.get('checkInCode');

  const body = JSON.stringify({ email, orderId, checkInCode });

  return POST(
    new NextRequest(req.nextUrl, {
      method: 'POST',
      body,
      headers: req.headers,
    })
  );
}
