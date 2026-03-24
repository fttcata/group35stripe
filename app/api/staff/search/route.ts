import { NextResponse, NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

interface SearchResult {
  orderId: string
  customerEmail: string
  guestName: string | null
  eventId: string
  eventTitle: string
  totalAmount: number
  paymentStatus: string
  unCheckedInCount: number
  tickets: Array<{
    id: string
    ticketCode: string
    ticketType: string
    isUsed: boolean
  }>
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParam = request.nextUrl.searchParams.get('search')
    if (!searchParam || searchParam.trim().length === 0) {
      return NextResponse.json({ results: [] })
    }

    const searchTerm = searchParam.trim()
    const upperSearchTerm = searchTerm.toUpperCase()

    const { data: orders } = await supabase
      .from('orders')
      .select(`
        id,
        customer_email,
        guest_email,
        guest_name,
        total_amount,
        payment_status,
        event_id,
        events (id, title),
        tickets (id, ticket_code, ticket_type, is_used)
      `)
      .in('payment_status', ['completed', 'completed_email_failed', 'pending'])
      .order('created_at', { ascending: false })
      .limit(50)

    if (!orders) {
      return NextResponse.json({ results: [] })
    }

    const filtered = orders.filter(order => {
      const customerEmail = order.customer_email?.toLowerCase() || ''
      const guestEmail = order.guest_email?.toLowerCase() || ''
      const guestName = order.guest_name?.toLowerCase() || ''
      const searchLower = searchTerm.toLowerCase()

      if (customerEmail.includes(searchLower) || guestEmail.includes(searchLower)) {
        return true
      }

      if (guestName.includes(searchLower)) {
        return true
      }

      if (order.tickets && order.tickets.some(t => t.ticket_code === upperSearchTerm)) {
        return true
      }

      return false
    })

    const results: SearchResult[] = filtered.map(order => {
      const eventData = Array.isArray(order.events) ? order.events[0] : order.events
      const tickets = (order.tickets || []).map(t => ({
        id: t.id,
        ticketCode: t.ticket_code,
        ticketType: t.ticket_type,
        isUsed: t.is_used || false,
      }))

      const unCheckedInCount = tickets.filter(t => !t.isUsed).length

      return {
        orderId: order.id,
        customerEmail: order.customer_email || order.guest_email || 'Unknown',
        guestName: order.guest_name || null,
        eventId: order.event_id,
        eventTitle: eventData?.title || 'Unknown Event',
        totalAmount: parseFloat(order.total_amount || '0'),
        paymentStatus: order.payment_status,
        unCheckedInCount,
        tickets,
      }
    })

    results.sort((a, b) => {
      if (a.unCheckedInCount > 0 && b.unCheckedInCount === 0) return -1
      if (a.unCheckedInCount === 0 && b.unCheckedInCount > 0) return 1
      return 0
    })

    return NextResponse.json({ results: results.slice(0, 20) })
  } catch (error) {
    console.error('Staff search error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
