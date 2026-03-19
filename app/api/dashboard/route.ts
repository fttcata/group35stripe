import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

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
  ticketTypes?: Array<{
    id: string
    name: string
    price?: number
    totalQuantity: number
    sold: number
  }>
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

function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export async function GET() {
  try {
    const authClient = await createSupabaseServerClient()
    const { data: { user } } = await authClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = user.user_metadata?.role
    if (role !== 'organizer') {
      return NextResponse.json({ error: 'Forbidden: organizer role required' }, { status: 403 })
    }

    // Use service-role key for analytics queries when available.
    // Fallback to the authenticated server client to preserve user session and RLS context.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    const supabase = (supabaseUrl && serviceKey)
      ? createClient(supabaseUrl, serviceKey)
      : authClient

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
      .select('id,event_id,name,price,quantity,quantity_available')
      .in('event_id', eventIds)

    // Track configured capacity and current remaining stock separately.
    const configuredCapacityByEvent: Record<string, number> = {}
    const remainingByEvent: Record<string, number> = {}

    for (const tt of ticketTypes || []) {
      if (tt.quantity !== null && tt.quantity !== undefined) {
        configuredCapacityByEvent[tt.event_id] = (configuredCapacityByEvent[tt.event_id] || 0) + toNumber(tt.quantity)
      }
      if (tt.quantity_available !== null && tt.quantity_available !== undefined) {
        remainingByEvent[tt.event_id] = (remainingByEvent[tt.event_id] || 0) + toNumber(tt.quantity_available)
      }
    }

    // 3. Fetch completed orders for all events
    const { data: orders } = await supabase
      .from('orders')
      .select('id, event_id, total_amount, payment_status, customer_email, guest_email, created_at')
      .in('event_id', eventIds)
      .in('payment_status', ['completed', 'completed_email_failed'])
      .order('created_at', { ascending: false })

    // 4. Count sold quantity per order (order_items first, then tickets fallback)
    const orderIds = (orders || []).map(o => o.id)
    const soldByOrder: Record<string, number> = {}
    const ticketsByOrder: Record<string, number> = {}

    if (orderIds.length > 0) {
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('order_id,quantity')
        .in('order_id', orderIds)

      for (const item of orderItems || []) {
        soldByOrder[item.order_id] = (soldByOrder[item.order_id] || 0) + toNumber(item.quantity)
      }

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
      revenueByEvent[eid] = (revenueByEvent[eid] || 0) + toNumber(order.total_amount)
      soldByEvent[eid] = (soldByEvent[eid] || 0) + (soldByOrder[order.id] ?? ticketsByOrder[order.id] ?? 0)
    }

    // 6. Build enriched events array
    const now = new Date().toISOString()

    const allEvents: DashboardEvent[] = events.map(e => {
      const sold = soldByEvent[e.id] || 0
      const configured = configuredCapacityByEvent[e.id]
      const remaining = remainingByEvent[e.id]

      const totalCapacity =
        configured !== undefined
          ? configured
          : remaining !== undefined
            ? remaining + sold
            : sold

      const ticketsRemaining =
        configured !== undefined
          ? Math.max(0, totalCapacity - sold)
          : remaining !== undefined
            ? Math.max(0, remaining)
            : Math.max(0, totalCapacity - sold)

      return {
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
        ticketsSold: sold,
        totalCapacity,
        ticketsRemaining,
        revenue: revenueByEvent[e.id] || 0,
        ticketTypes: (ticketTypes || [])
          .filter((tt: any) => tt.event_id === e.id)
          .map((tt: any) => ({
            id: tt.id,
            name: tt.name,
            price: toNumber(tt.price),
            totalQuantity:
              tt.quantity !== null && tt.quantity !== undefined
                ? toNumber(tt.quantity)
                : toNumber(tt.quantity_available),
            sold: 0,
          })),
      }
    })

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
        amount: toNumber(order.total_amount),
        createdAt: order.created_at,
        ticketCount: soldByOrder[order.id] ?? ticketsByOrder[order.id] ?? 0,
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

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
