import { NextRequest, NextResponse } from 'next/server';
import { sendPaymentReminderEmail } from '../../../lib/emailService';

interface CheckInRequest {
  email?: string;
  eventTitle?: string;
  eventDate?: string;
  amount?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body: CheckInRequest = await req.json().catch(() => ({}));

    const email = body.email?.trim();
    const eventTitle = body.eventTitle?.trim() || 'Event Ticket';
    const eventDate = body.eventDate?.trim() || new Date().toISOString();
    const amount = typeof body.amount === 'number' && Number.isFinite(body.amount) ? body.amount : 0;

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
    }

    const orderId = `CHECKIN-${Date.now()}`;
    const emailResult = await sendPaymentReminderEmail(
      email,
      eventTitle,
      eventDate,
      amount,
      orderId
    );

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
