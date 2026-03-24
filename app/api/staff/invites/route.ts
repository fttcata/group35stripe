import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { generateInviteCode, getAuthenticatedUserForRoute, isUserOrganizerForEvent, normalizeEmail } from '@/lib/staffAccess';
import { sendStaffInviteEmail } from '@/lib/emailService';

interface CreateInvitesBody {
  eventId?: string;
  emails?: string[];
}

async function requireOrganizer(eventId: string, userId: string) {
  const allowed = await isUserOrganizerForEvent(eventId, userId);
  return allowed;
}

export async function GET(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const user = await getAuthenticatedUserForRoute();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const eventId = req.nextUrl.searchParams.get('eventId');
    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    }

    const isOrganizer = await requireOrganizer(eventId, user.id);
    if (!isOrganizer) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: invites, error } = await supabase
      .from('event_staff_invites')
      .select('id, invited_email, invite_code, status, created_at, claimed_at, expires_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ invites: invites || [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load invites' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const user = await getAuthenticatedUserForRoute();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body: CreateInvitesBody = await req.json();
    const eventId = String(body.eventId || '').trim();
    const emails = Array.isArray(body.emails) ? body.emails : [];

    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    }

    if (emails.length === 0) {
      return NextResponse.json({ error: 'At least one email is required' }, { status: 400 });
    }

    const isOrganizer = await requireOrganizer(eventId, user.id);
    if (!isOrganizer) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const uniqueEmails = [...new Set(emails.map((e) => normalizeEmail(String(e || ''))).filter(Boolean))];

    const { data: event } = await supabase
      .from('events')
      .select('id, title, status')
      .eq('id', eventId)
      .single();

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (event.status !== 'published') {
      return NextResponse.json({ error: 'Publish the event before inviting staff' }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();

    const created: string[] = [];
    const failed: Array<{ email: string; reason: string }> = [];

    for (const email of uniqueEmails) {
      const inviteCode = generateInviteCode(8);

      const { error: upsertError } = await supabase
        .from('event_staff_invites')
        .upsert(
          {
            event_id: eventId,
            invited_email: email,
            invite_code: inviteCode,
            invited_by: user.id,
            status: 'pending',
            claimed_by: null,
            claimed_at: null,
            expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'event_id,invited_email' }
        );

      if (upsertError) {
        failed.push({ email, reason: upsertError.message });
        continue;
      }

      const emailResult = await sendStaffInviteEmail({
        email,
        eventTitle: event.title,
        inviteCode,
        inviterName: profile?.full_name || undefined,
      });

      if (!emailResult.success) {
        failed.push({ email, reason: emailResult.error || 'Failed to send email' });
        continue;
      }

      created.push(email);
    }

    return NextResponse.json({
      success: true,
      invited: created,
      failed,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create invites' }, { status: 500 });
  }
}
