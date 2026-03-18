import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

interface DashboardEvent {
  id: string
  title: string
  description: string
  start_date: string
  end_time: string
  sport_category: string
  venue: string
  images: string[]
  status: 'draft' | 'published'
  created_at: string
  ticketsSold: number
  ticketsRemaining: number
  totalCapacity: number
  revenue: number
}

interface RecentActivity {
  orderId: string
  customerEmail: string
  eventTitle: string
  amount: number
  createdAt: string
  ticketCount: number
}

interface DashboardData {
  summary: {
    totalEvents: number
    totalTicketsSold: number
    totalRevenue: number
    totalTicketsRemaining: number
  }
  upcomingEvents: DashboardEvent[]
  recentActivity: RecentActivity[]
  allEvents: DashboardEvent[]
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = user.user_metadata?.role
    if (role !== 'organizer') {
      return NextResponse.json({ error: 'Forbidden: organizer role required' }, { status: 403 })
    }

    // 1. Fetch all organizer's events
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, title, description, start_date, end_time, sport_category, venue, images, status, created_at')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })

    if (eventsError) {
      return NextResponse.json({ error: eventsError.message }, { status: 500 })
    }

    if (!events || events.length === 0) {
      const empty: DashboardData = {
        summary: { totalEvents: 0, totalTicketsSold: 0, totalRevenue: 0, totalTicketsRemaining: 0 },
        upcomingEvents: [],
        recentActivity: [],
        allEvents: [],
      }
      return NextResponse.json(empty)
    }

    const eventIds = events.map(e => e.id)

    // 2. Fetch ticket_types for all events in one query
    const { data: ticketTypes } = await supabase
      .from('ticket_types')
      .select('*')
      .in('event_id', eventIds)

    // Build capacity map per event (handle both column names)
    const capacityByEvent: Record<string, number> = {}
    for (const tt of ticketTypes || []) {
      const qty = tt.quantity_available ?? tt.quantity ?? 0
      capacityByEvent[tt.event_id] = (capacityByEvent[tt.event_id] || 0) + qty
    }

    // 3. Fetch completed orders for all events
    const { data: orders } = await supabase
      .from('orders')
      .select('id, event_id, total_amount, payment_status, customer_email, guest_email, created_at')
      .in('event_id', eventIds)
      .in('payment_status', ['completed', 'completed_email_failed'])
      .order('created_at', { ascending: false })

    // 4. Count tickets sold per order
    const orderIds = (orders || []).map(o => o.id)
    const ticketsByOrder: Record<string, number> = {}

    if (orderIds.length > 0) {
      const { data: tickets } = await supabase
        .from('tickets')
        .select('id, order_id')
        .in('order_id', orderIds)

      for (const t of tickets || []) {
        ticketsByOrder[t.order_id] = (ticketsByOrder[t.order_id] || 0) + 1
      }
    }

    // 5. Aggregate per-event metrics
    const revenueByEvent: Record<string, number> = {}
    const soldByEvent: Record<string, number> = {}

    for (const order of orders || []) {
      const eid = order.event_id
      revenueByEvent[eid] = (revenueByEvent[eid] || 0) + parseFloat(order.total_amount || '0')
      soldByEvent[eid] = (soldByEvent[eid] || 0) + (ticketsByOrder[order.id] || 0)
    }

    // 6. Build enriched events array
    const now = new Date().toISOString()

    const allEvents: DashboardEvent[] = events.map(e => ({
      id: e.id,
      title: e.title,
      description: e.description || '',
      start_date: e.start_date,
      end_time: e.end_time || '',
      sport_category: e.sport_category || '',
      venue: e.venue || '',
      images: e.images || [],
      status: e.status,
      created_at: e.created_at,
      ticketsSold: soldByEvent[e.id] || 0,
      totalCapacity: capacityByEvent[e.id] || 0,
      ticketsRemaining: Math.max(0, (capacityByEvent[e.id] || 0) - (soldByEvent[e.id] || 0)),
      revenue: revenueByEvent[e.id] || 0,
    }))

    // 7. Upcoming events: published, future, sorted by date ascending
    const upcomingEvents = allEvents
      .filter(e => e.start_date > now && e.status === 'published')
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
      .slice(0, 5)

    // 8. Recent activity feed
    const eventTitleMap: Record<string, string> = {}
    for (const e of events) {
      eventTitleMap[e.id] = e.title
    }

    const recentActivity: RecentActivity[] = (orders || [])
      .slice(0, 15)
      .map(order => ({
        orderId: order.id,
        customerEmail: order.customer_email || order.guest_email || 'Unknown',
        eventTitle: eventTitleMap[order.event_id] || 'Unknown Event',
        amount: parseFloat(order.total_amount || '0'),
        createdAt: order.created_at,
        ticketCount: ticketsByOrder[order.id] || 0,
      }))

    // 9. Summary totals
    const summary = {
      totalEvents: events.length,
      totalTicketsSold: allEvents.reduce((sum, e) => sum + e.ticketsSold, 0),
      totalRevenue: allEvents.reduce((sum, e) => sum + e.revenue, 0),
      totalTicketsRemaining: allEvents.reduce((sum, e) => sum + e.ticketsRemaining, 0),
    }

    const response: DashboardData = {
      summary,
      upcomingEvents,
      recentActivity,
      allEvents,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
