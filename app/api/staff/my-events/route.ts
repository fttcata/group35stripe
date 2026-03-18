import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getAuthenticatedUserForRoute } from '@/lib/staffAccess';

export async function GET() {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const user = await getAuthenticatedUserForRoute();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: memberships, error } = await supabase
      .from('event_staff_memberships')
      .select('event_id, status, events(id, title, start_date, venue)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      events: (memberships || []).map((m: any) => ({
        eventId: m.event_id,
        title: m.events?.title || 'Event',
        startDate: m.events?.start_date || null,
        venue: m.events?.venue || null,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load staff events' }, { status: 500 });
  }
}
