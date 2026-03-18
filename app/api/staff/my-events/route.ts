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

    const staffEvents = (memberships || []).map((m: any) => ({
        eventId: m.event_id,
        title: m.events?.title || 'Event',
        startDate: m.events?.start_date || null,
        venue: m.events?.venue || null,
      }));

    const { data: ownedEvents, error: ownedEventsError } = await supabase
      .from('events')
      .select('id, title, start_date, venue')
      .eq('created_by', user.id)
      .order('start_date', { ascending: true });

    if (ownedEventsError) {
      return NextResponse.json({ error: ownedEventsError.message }, { status: 500 });
    }

    const organizerEvents = (ownedEvents || []).map((e: any) => ({
      eventId: e.id,
      title: e.title || 'Event',
      startDate: e.start_date || null,
      venue: e.venue || null,
    }));

    const mergedByEventId = new Map<string, { eventId: string; title: string; startDate: string | null; venue: string | null }>();
    [...staffEvents, ...organizerEvents].forEach((e) => {
      mergedByEventId.set(e.eventId, e);
    });

    return NextResponse.json({
      events: Array.from(mergedByEventId.values()),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load staff events' }, { status: 500 });
  }
}
