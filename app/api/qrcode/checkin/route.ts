import { NextResponse, NextRequest } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        payment_status,
        total_amount,
        tickets (
          id,
          is_used
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    const isPaid = order.payment_status === 'completed' || order.payment_status === 'paid';
    const tickets = order.tickets || [];
    const alreadyUsed = tickets.some((t: any) => t.is_used);

    // If already checked in
    if (alreadyUsed) {
      return NextResponse.json(
        { error: 'Ticket already checked in', alreadyUsed: true },
        { status: 400 }
      );
    }

    // If paid, mark all tickets as used
    if (isPaid) {
      const ticketIds = tickets.map((t: any) => t.id);
      const { error: updateError } = await supabase
        .from('tickets')
        .update({
          is_used: true,
          used_at: new Date().toISOString(),
        })
        .in('id', ticketIds);

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to mark tickets as used' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        isPaid: true,
        message: 'Checked in successfully',
      });
    }

    // If not paid, return info that payment is needed
    // The mobile app or terminal will handle payment collection
    return NextResponse.json({
      success: true,
      isPaid: false,
      amountDue: order.total_amount || 0,
      message: 'Payment required - initiate payment collection',
    });
  } catch (error) {
    console.error('Check-in error:', error);
    return NextResponse.json(
      { error: 'Failed to process check-in' },
      { status: 500 }
    );
  }
}
