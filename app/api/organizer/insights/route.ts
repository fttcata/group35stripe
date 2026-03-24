/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { createSupabaseServerClient } from '@/lib/supabase/server';

function isOrganizerRole(role: unknown): boolean {
  if (typeof role !== 'string') return false;
  const normalized = role.trim().toLowerCase();
  return normalized === 'organizer' || normalized === 'organiser';
}

function toIsoOrNull(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export async function GET(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const serverClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await serverClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!isOrganizerRole(profile?.role || user.user_metadata?.role)) {
      return NextResponse.json({ error: 'Organizer access required' }, { status: 403 });
    }

    const params = req.nextUrl.searchParams;
    const eventIdFilter = params.get('eventId');
    const fromFilter = toIsoOrNull(params.get('from'));
    const toFilter = toIsoOrNull(params.get('to'));

    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, title, start_date, status, created_at')
      .eq('created_by', user.id)
      .order('start_date', { ascending: true });

    if (eventsError) {
      return NextResponse.json({ error: eventsError.message }, { status: 500 });
    }

    let ownedEvents = events || [];

    // Fallback for dev/seeded environments: if no events are found under this
    // user's ID (because seeded events have created_by = NULL), also include
    // events where created_by is null so revenue data is still visible.
    if (ownedEvents.length === 0) {
      const { data: unseededEvents } = await supabase
        .from('events')
        .select('id, title, start_date, status, created_at')
        .is('created_by', null)
        .order('start_date', { ascending: true });
      ownedEvents = unseededEvents || [];
    }

    let scopedEvents = ownedEvents;

    if (eventIdFilter && eventIdFilter !== 'all') {
      scopedEvents = ownedEvents.filter((e: any) => String(e.id) === eventIdFilter);
    }

    const scopedEventIds = scopedEvents.map((e: any) => e.id);
    if (scopedEventIds.length === 0) {
      return NextResponse.json({
        filters: { eventId: eventIdFilter || 'all', from: fromFilter, to: toFilter },
        events: ownedEvents,
        summary: {
          totalEvents: 0,
          publishedEvents: 0,
          draftEvents: 0,
          totalOrders: 0,
          paidOrders: 0,
          pendingOrders: 0,
          totalRevenue: 0,
          averageOrderValue: 0,
          uniqueBuyers: 0,
          totalTicketsIssued: 0,
          totalTicketsCheckedIn: 0,
          checkInRatePct: 0,
        },
        byEvent: [],
        byTicketType: [],
        purchasesByHour: Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0, revenue: 0 })),
        checkinsByHour: Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 })),
        purchasesByDay: [],
        paymentMethodBreakdown: [],
      });
    }

    let ordersQuery = supabase
      .from('orders')
      .select('id, event_id, total_amount, payment_status, payment_method, customer_email, created_at')
      .in('event_id', scopedEventIds)
      .order('created_at', { ascending: true });

    if (fromFilter) ordersQuery = ordersQuery.gte('created_at', fromFilter);
    if (toFilter) ordersQuery = ordersQuery.lte('created_at', toFilter);

    const { data: orders, error: ordersError } = await ordersQuery;
    if (ordersError) {
      return NextResponse.json({ error: ordersError.message }, { status: 500 });
    }

    const orderRows = orders || [];
    const orderIds = orderRows.map((o: any) => o.id);

    let ticketRows: any[] = [];
    if (orderIds.length > 0) {
      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select('id, order_id, ticket_type, is_used, created_at, used_at')
        .in('order_id', orderIds);

      if (ticketsError) {
        return NextResponse.json({ error: ticketsError.message }, { status: 500 });
      }

      ticketRows = tickets || [];
    }

    const eventById = new Map(ownedEvents.map((e: any) => [e.id, e]));

    const paidStatuses = new Set(['paid', 'completed', 'completed_email_failed']);
    const paidOrders = orderRows.filter((o: any) =>
      paidStatuses.has(String(o.payment_status || '').toLowerCase()) ||
      String(o.payment_method || '').toLowerCase() === 'pay-on-day'
    );
    const pendingOrders = orderRows.length - paidOrders.length;

    const totalRevenue = paidOrders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);
    const averageOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;

    const uniqueBuyers = new Set(
      orderRows
        .map((o: any) => String(o.customer_email || '').trim().toLowerCase())
        .filter((email: string) => email.length > 0)
    ).size;

    const totalTicketsIssued = ticketRows.length;
    const totalTicketsCheckedIn = ticketRows.filter((t: any) => t.is_used).length;
    const checkInRatePct = totalTicketsIssued > 0 ? (totalTicketsCheckedIn / totalTicketsIssued) * 100 : 0;

    const ordersByEvent = new Map<string, any[]>();
    orderRows.forEach((o: any) => {
      const id = String(o.event_id || '');
      const current = ordersByEvent.get(id) || [];
      current.push(o);
      ordersByEvent.set(id, current);
    });

    const ticketsByOrder = new Map<string, any[]>();
    ticketRows.forEach((t: any) => {
      const id = String(t.order_id || '');
      const current = ticketsByOrder.get(id) || [];
      current.push(t);
      ticketsByOrder.set(id, current);
    });

    const isOrderPaid = (o: any) =>
      paidStatuses.has(String(o.payment_status || '').toLowerCase()) ||
      String(o.payment_method || '').toLowerCase() === 'pay-on-day';

    const byEvent = scopedEvents.map((e: any) => {
      const eventOrders = ordersByEvent.get(String(e.id)) || [];
      const eventPaidOrders = eventOrders.filter(isOrderPaid);
      const orderTicketCount = eventOrders.reduce((sum: number, o: any) => sum + (ticketsByOrder.get(String(o.id)) || []).length, 0);
      const checkIns = eventOrders.reduce(
        (sum: number, o: any) => sum + (ticketsByOrder.get(String(o.id)) || []).filter((t: any) => t.is_used).length,
        0
      );

      return {
        eventId: e.id,
        title: e.title,
        status: e.status,
        startDate: e.start_date,
        orders: eventOrders.length,
        paidOrders: eventPaidOrders.length,
        pendingOrders: eventOrders.length - eventPaidOrders.length,
        revenue: eventPaidOrders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0),
        ticketsIssued: orderTicketCount,
        ticketsCheckedIn: checkIns,
      };
    });

    const ticketTypeMap = new Map<string, { type: string; count: number; checkedIn: number }>();
    ticketRows.forEach((t: any) => {
      const key = String(t.ticket_type || 'Unknown');
      const current = ticketTypeMap.get(key) || { type: key, count: 0, checkedIn: 0 };
      current.count += 1;
      if (t.is_used) current.checkedIn += 1;
      ticketTypeMap.set(key, current);
    });

    const byTicketType = Array.from(ticketTypeMap.values()).sort((a, b) => b.count - a.count);

    const purchasesByHour = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0, revenue: 0 }));
    orderRows.forEach((o: any) => {
      const d = new Date(o.created_at);
      if (Number.isNaN(d.getTime())) return;
      const h = d.getHours();
      purchasesByHour[h].count += 1;
      if (isOrderPaid(o)) {
        purchasesByHour[h].revenue += Number(o.total_amount || 0);
      }
    });

    const checkinsByHour = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
    ticketRows.forEach((t: any) => {
      if (!t.is_used || !t.used_at) return;
      const d = new Date(t.used_at);
      if (Number.isNaN(d.getTime())) return;
      checkinsByHour[d.getHours()].count += 1;
    });

    const purchasesByDayMap = new Map<string, { day: string; orders: number; revenue: number }>();
    orderRows.forEach((o: any) => {
      const d = new Date(o.created_at);
      if (Number.isNaN(d.getTime())) return;
      const day = d.toISOString().slice(0, 10);
      const row = purchasesByDayMap.get(day) || { day, orders: 0, revenue: 0 };
      row.orders += 1;
      if (isOrderPaid(o)) {
        row.revenue += Number(o.total_amount || 0);
      }
      purchasesByDayMap.set(day, row);
    });

    const paymentMethodMap = new Map<string, { method: string; count: number; revenue: number }>();
    orderRows.forEach((o: any) => {
      const method = String(o.payment_method || 'unknown');
      const row = paymentMethodMap.get(method) || { method, count: 0, revenue: 0 };
      row.count += 1;
      if (isOrderPaid(o)) {
        row.revenue += Number(o.total_amount || 0);
      }
      paymentMethodMap.set(method, row);
    });

    return NextResponse.json({
      filters: { eventId: eventIdFilter || 'all', from: fromFilter, to: toFilter },
      events: ownedEvents,
      summary: {
        totalEvents: scopedEvents.length,
        publishedEvents: scopedEvents.filter((e: any) => e.status === 'published').length,
        draftEvents: scopedEvents.filter((e: any) => e.status === 'draft').length,
        totalOrders: orderRows.length,
        paidOrders: paidOrders.length,
        pendingOrders,
        totalRevenue,
        averageOrderValue,
        uniqueBuyers,
        totalTicketsIssued,
        totalTicketsCheckedIn,
        checkInRatePct,
      },
      byEvent: byEvent.sort((a, b) => b.revenue - a.revenue),
      byTicketType,
      purchasesByHour,
      checkinsByHour,
      purchasesByDay: Array.from(purchasesByDayMap.values()).sort((a, b) => a.day.localeCompare(b.day)),
      paymentMethodBreakdown: Array.from(paymentMethodMap.values()).sort((a, b) => b.revenue - a.revenue),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load insights' }, { status: 500 });
  }
}
