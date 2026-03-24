import { NextRequest, NextResponse } from 'next/server';
import { createTickets } from '../../../lib/ticketService';
import { sendTicketConfirmationEmail } from '../../../lib/emailService';
import { supabase } from '../../../lib/supabaseClient';
import { isAuthenticatedOrganizer } from '@/lib/organizerGuard';

interface CheckInRequest {
  email?: string;
  eventTitle?: string;
  eventDate?: string;
  amount?: number;
  eventId?: string;
  quantity?: number;
  items?: Array<{
    ticketTypeId?: string;
    name?: string;
    price?: number;
    quantity: number;
  }>;
}

const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

export async function POST(req: NextRequest) {
  try {
    if (await isAuthenticatedOrganizer()) {
      return NextResponse.json(
        { error: 'Organizers cannot buy tickets. Use an attendee account to register for events.' },
        { status: 403 }
      );
    }

    const body: CheckInRequest = await req.json().catch(() => ({}));

    const email = body.email?.trim();
    const eventTitle = body.eventTitle?.trim() || 'Event Ticket';
    const eventDate = body.eventDate?.trim() || new Date().toISOString();
    const amount = typeof body.amount === 'number' && Number.isFinite(body.amount) ? body.amount : 0;
    const eventId = body.eventId?.trim();
    const quantity = typeof body.quantity === 'number' && Number.isFinite(body.quantity) && body.quantity > 0
      ? Math.floor(body.quantity)
      : 1;
    const eventIdMatch = eventId?.match(UUID_REGEX);
    const eventIdForDb = eventIdMatch ? eventIdMatch[0] : null;
    const items = (body.items || []).filter(item => Number(item.quantity) > 0);

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Look up the buyer's profile ID so we can store user_id on the order
    // and show it in "My Purchases". This is best-effort — guests won't have one.
    let buyerUserId: string | null = null;
    try {
      const { data: buyerProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      buyerUserId = buyerProfile?.id ?? null;
    } catch {
      // ignore — guests have no profile
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          event_id: eventIdForDb,
          customer_email: email,
          payment_method: 'pay-on-day',
          total_amount: amount,
          payment_status: 'pending',
          user_id: buyerUserId,
        },
      ])
      .select('id')
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: orderError?.message || 'Failed to create pending check-in order' },
        { status: 500 }
      );
    }

    const orderId = order.id as string;

    const orderItems = (items.length > 0 ? items : [{ quantity }]).map(item => ({
      order_id: orderId,
      ticket_type_id: item.ticketTypeId || null,
      quantity: Math.max(1, Number(item.quantity) || 1),
    }));

    const { error: orderItemError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (orderItemError) {
      console.warn('Failed to create order_items row for check-in order:', orderItemError);
    }

    const tickets = await createTickets(orderId, eventTitle, 'General Admission', quantity);

    const emailResult = await sendTicketConfirmationEmail({
      customer_email: email,
      event_title: eventTitle,
      event_date: eventDate,
      tickets,
      total_amount: amount,
      payment_method: 'pay-on-day',
      order_id: orderId,
    });

    // Create in-app notification if user has an account
    try {
      if (buyerUserId) {
        await supabase.from('notifications').insert({
          user_id: buyerUserId,
          type: 'ticket_confirmation',
          title: 'Ticket Reserved — Pay on the Day',
          message: `Your ${tickets.length} ticket${tickets.length !== 1 ? 's' : ''} for “${eventTitle}” ${tickets.length !== 1 ? 'are' : 'is'} reserved. Please pay at the door on arrival.`,
          link: '/account',
        });
      }
    } catch {
      // Notifications table may not exist yet — don't fail the checkout
    }

    if (!emailResult.success) {
      return NextResponse.json(
        { error: emailResult.error || 'Failed to send check-in confirmation email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: emailResult.messageId,
      orderId,
      amountDue: amount,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
