import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getAuthenticatedUserForRoute } from '@/lib/staffAccess';

interface ClaimBody {
  code?: string;
}

export async function POST(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const user = await getAuthenticatedUserForRoute();
    if (!user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: ClaimBody = await req.json();
    const code = String(body.code || '').trim().toUpperCase();
    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    const { data: invite, error: inviteError } = await supabase
      .from('event_staff_invites')
      .select('id, event_id, invited_email, status, expires_at')
      .eq('invite_code', code)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
    }

    if (invite.status !== 'pending') {
      return NextResponse.json({ error: 'Invite code already used or revoked' }, { status: 400 });
    }

    if ((invite.invited_email || '').toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json({ error: 'Invite code does not match your account email' }, { status: 403 });
    }

    if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Invite code expired' }, { status: 400 });
    }

    const { error: membershipError } = await supabase
      .from('event_staff_memberships')
      .upsert(
        {
          event_id: invite.event_id,
          user_id: user.id,
          granted_by: null,
          source_invite_id: invite.id,
          status: 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'event_id,user_id' }
      );

    if (membershipError) {
      return NextResponse.json({ error: membershipError.message }, { status: 500 });
    }

    const { error: updateInviteError } = await supabase
      .from('event_staff_invites')
      .update({
        status: 'claimed',
        claimed_by: user.id,
        claimed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', invite.id);

    if (updateInviteError) {
      return NextResponse.json({ error: updateInviteError.message }, { status: 500 });
    }

    const { data: event } = await supabase
      .from('events')
      .select('title')
      .eq('id', invite.event_id)
      .single();

    return NextResponse.json({ success: true, eventTitle: event?.title || 'Event' });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to claim invite' }, { status: 500 });
  }
}
