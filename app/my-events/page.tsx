'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import StripeConnectButton from '@/app/account/StripeConnectButton'

type TicketInfo = {
  name: string
  price: number
  quantity: number
  sold: number
}

type EventManagement = {
  id: string
  title: string
  description: string
  start_date: string
  sport_category: string
  venue: string
  images: string[]
  status: 'draft' | 'published'
  tickets?: TicketInfo[]
  totalTickets?: number
  totalSold?: number
  isCoOrganizer?: boolean
}

export default function MyEventsPage() {
  const [allEvents, setAllEvents] = useState<EventManagement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'published'>('all')
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [payoutConnected, setPayoutConnected] = useState(false)
  const [payoutChecked, setPayoutChecked] = useState(false)

  useEffect(() => {
    loadAllEvents()
  }, [])

  const loadAllEvents = async () => {
    try {
      setLoading(true)
      const supabase = createSupabaseBrowserClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user?.id) {
        setError('Please sign in to manage your events')
        setAllEvents([])
        return
      }

      // Check if user has organizer role
      const { data: profile } = await supabase.from('profiles').select('role,stripe_account_id').eq('id', user.id).maybeSingle()
      const dbRole = (profile?.role || '').toLowerCase()
      const metaRole = String(user.user_metadata?.role || '').toLowerCase()
      const orgRole = dbRole === 'organizer' || dbRole === 'organiser' || metaRole === 'organizer' || metaRole === 'organiser'
      setIsOrganizer(orgRole)
      setPayoutConnected(Boolean(profile?.stripe_account_id))
      setPayoutChecked(true)

      let { data, error: dbError } = await supabase
        .from('events')
        .select('id,title,description,start_date,sport_category,venue,images,status')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })

      // Dev fallback: seeded events have created_by = NULL
      if (!dbError && (!data || data.length === 0)) {
        const { data: unseeded, error: unseededErr } = await supabase
          .from('events')
          .select('id,title,description,start_date,sport_category,venue,images,status')
          .is('created_by', null)
          .order('created_at', { ascending: false })
        data = unseeded || []
        dbError = unseededErr
      }

      if (dbError) {
        setError('Failed to load events')
        console.error(dbError)
        return
      }

      // Fetch events where user is an accepted co-organizer
      const { data: coOrgEntries } = await supabase
        .from('event_co_organizers')
        .select('event_id')
        .eq('user_id', user.id)
        .eq('status', 'accepted')

      let coOrgEvents: typeof data = []
      if (coOrgEntries && coOrgEntries.length > 0) {
        const coOrgIds = coOrgEntries.map(e => e.event_id)
        const { data: coData } = await supabase
          .from('events')
          .select('id,title,description,start_date,sport_category,venue,images,status')
          .in('id', coOrgIds)
          .order('created_at', { ascending: false })
        coOrgEvents = coData || []
      }

      // Merge, marking co-organizer events
      const ownIds = new Set((data || []).map(e => e.id))
      const allRawEvents = [
        ...(data || []),
        ...coOrgEvents.filter(e => !ownIds.has(e.id)).map(e => ({ ...e, isCoOrganizer: true })),
      ]

      // Fetch ticket information for each event (non-blocking)
      const eventsWithTickets = await Promise.all(
        allRawEvents.map(async (event) => {
          try {
            // Try to fetch tickets with quantity field
            const { data: tickets, error: ticketError } = await supabase
              .from('ticket_types')
              .select('name,price,quantity,quantity_available,id')
              .eq('event_id', event.id)

            if (ticketError) {
              // If quantity column doesn't exist, try without it
              const { data: ticketsAlt, error: altError } = await supabase
                .from('ticket_types')
                .select('name,price,id')
                .eq('event_id', event.id)
              
              if (altError) {
                console.warn(`Failed to fetch tickets for event ${event.id}`)
                return event as EventManagement
              }

              // Map without quantity
              const ticketsWithDefault: TicketInfo[] = (ticketsAlt || []).map(t => ({
                name: t.name,
                price: t.price,
                quantity: 0, // Default if column doesn't exist
                sold: 0,
              }))

              return {
                ...event,
                tickets: ticketsWithDefault,
                totalTickets: 0,
                totalSold: 0,
              } as EventManagement
            }

            // Count sold tickets per event using completed orders
            let totalSold = 0
            const totalTickets = (tickets || []).reduce(
              (sum, t: { quantity_available?: number | null; quantity?: number | null }) =>
                sum + (Number(t.quantity_available ?? t.quantity ?? 0) || 0),
              0
            )

            // Prefer server-side sales analytics (handles RLS)
            let salesApiOk = false
            try {
              const res = await fetch(`/api/events/${event.id}/sales`)
              if (res.ok) {
                const data = await res.json()
                const apiSold = Number(data?.ticketsSold || 0)
                totalSold = Number.isFinite(apiSold) ? apiSold : 0
                salesApiOk = true
              }
            } catch (err) {
              console.debug(`Sales API fetch failed for event ${event.id}:`, err)
            }

            if (!salesApiOk) {
              try {
                // Fetch all completed orders for this event
                const { data: orders } = await supabase
                  .from('orders')
                  .select('id')
                  .eq('event_id', event.id)
                  .in('payment_status', ['completed', 'completed_email_failed'])

                if (orders && orders.length > 0) {
                  const orderIds = orders.map(o => o.id)

                  // Prefer order_items quantity, then fallback to tickets count
                  const { data: orderItems } = await supabase
                    .from('order_items')
                    .select('quantity')
                    .in('order_id', orderIds)

                  if (orderItems && orderItems.length > 0) {
                    totalSold = orderItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
                  } else {
                    // Fallback: count tickets rows
                    const { data: ticketRows } = await supabase
                      .from('tickets')
                      .select('id, order_id')
                      .in('order_id', orderIds)

                    if (ticketRows && ticketRows.length > 0) {
                      const ticketsByOrder: Record<string, number> = {}
                      for (const t of ticketRows) {
                        ticketsByOrder[t.order_id] = (ticketsByOrder[t.order_id] || 0) + 1
                      }
                      totalSold = Object.values(ticketsByOrder).reduce((sum, qty) => sum + qty, 0)
                    }
                  }
                }
              } catch (err) {
                // If error fetching sold counts, continue with totalSold = 0
                console.debug(`Error counting sold tickets for event ${event.id}:`, err)
              }
            }

            // Build ticket info with per-type sold counts (if needed for display)
            const ticketsWithSold: TicketInfo[] = (tickets || []).map((t: { name: string; price: number; quantity?: number | null; quantity_available?: number | null }) => ({
              name: t.name,
              price: t.price,
              quantity: Number(t.quantity_available ?? t.quantity ?? 0) || 0,
              sold: 0, // Per-ticket-type sold count not tracked; use totalSold for event-level
            }))

            return {
              ...event,
              tickets: ticketsWithSold,
              totalTickets,
              totalSold,
            } as EventManagement
          } catch (err) {
            // If any error occurs, return event without ticket data
            console.debug(`Error loading ticket data for event ${event.id}:`, err)
            return event as EventManagement
          }
        })
      )

      setAllEvents(eventsWithTickets)
    } catch (err) {
      setError('An error occurred while loading events')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteEvent = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return

    try {
      const res = await fetch(`/api/events/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || 'Failed to delete event')
        console.error(data)
        return
      }

      setAllEvents(allEvents.filter(e => e.id !== id))
    } catch (err) {
      setError('An error occurred while deleting')
      console.error(err)
    }
  }

  const handleUnpublish = async (id: string) => {
    try {
      const supabase = createSupabaseBrowserClient()

      const { error: updateError } = await supabase
        .from('events')
        .update({ status: 'draft' })
        .eq('id', id)

      if (updateError) {
        setError('Failed to unpublish event')
        console.error(updateError)
        return
      }

      setAllEvents(allEvents.map(e => e.id === id ? { ...e, status: 'draft' } : e))
    } catch (err) {
      setError('An error occurred')
      console.error(err)
    }
  }

  const filteredEvents = filterStatus === 'all' 
    ? allEvents 
    : allEvents.filter(e => e.status === filterStatus)

  const draftCount = allEvents.filter(e => e.status === 'draft').length
  const publishedCount = allEvents.filter(e => e.status === 'published').length

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Loading your events...</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900">My Events</h1>
            <p className="text-slate-500 mt-2">Manage all your events in one place</p>
          </div>
          {isOrganizer && (
            <Link
              href="/submit-event"
              className="rounded-lg bg-indigo-500 text-white px-6 py-3 font-semibold hover:bg-indigo-600 transition-colors"
            >
              + Create Event
            </Link>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Stats */}
        {payoutChecked && (
          <div className="mb-6">
            <StripeConnectButton connected={payoutConnected} />
          </div>
        )}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg p-6 border border-slate-200">
            <p className="text-slate-500 text-sm mb-1">Total Events</p>
            <p className="text-3xl font-bold text-slate-900">{allEvents.length}</p>
          </div>
          <div className="bg-white rounded-lg p-6 border border-slate-200">
            <p className="text-slate-500 text-sm mb-1">Drafts</p>
            <p className="text-3xl font-bold text-amber-600">{draftCount}</p>
          </div>
          <div className="bg-white rounded-lg p-6 border border-slate-200">
            <p className="text-slate-500 text-sm mb-1">Published</p>
            <p className="text-3xl font-bold text-emerald-600">{publishedCount}</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              filterStatus === 'all'
                ? 'bg-indigo-500 text-white'
                : 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All ({allEvents.length})
          </button>
          <button
            onClick={() => setFilterStatus('draft')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              filterStatus === 'draft'
                ? 'bg-indigo-500 text-white'
                : 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Drafts ({draftCount})
          </button>
          <button
            onClick={() => setFilterStatus('published')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              filterStatus === 'published'
                ? 'bg-indigo-500 text-white'
                : 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Published ({publishedCount})
          </button>
        </div>

        {/* Events List */}
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
            <p className="text-slate-500 mb-4">No {filterStatus === 'all' ? '' : filterStatus} events yet</p>
            <Link
              href="/submit-event"
              className="text-indigo-500 hover:text-indigo-600 font-semibold"
            >
              Create your first event
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                className="bg-white rounded-lg p-6 border border-slate-200 hover:border-slate-300 transition-colors"
              >
                <div className="flex gap-6">
                  {event.images?.[0] && (
                    <img
                      src={event.images[0]}
                      alt={event.title}
                      className="w-32 h-32 rounded-lg object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-slate-900">{event.title}</h3>
                          <span
                            className={`text-xs px-3 py-1 rounded-lg font-semibold ${
                              event.status === 'draft'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {event.status === 'draft' ? 'Draft' : 'Published'}
                          </span>
                          {event.isCoOrganizer && (
                            <span className="text-xs px-3 py-1 rounded-lg font-semibold bg-indigo-50 text-indigo-700">
                              Co-Organizer
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 mb-3 line-clamp-2">{event.description}</p>
                        <div className="flex gap-4 text-sm text-slate-400 mb-4">
                          <span>{new Date(event.start_date).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>{event.sport_category}</span>
                          <span>•</span>
                          <span>{event.venue}</span>
                        </div>
                        
                        {/* Ticket Stats */}
                        {event.tickets && event.tickets.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-200">
                            <div className="flex flex-wrap gap-6 text-sm">
                              {(event.totalTickets || 0) > 0 && (
                                <div>
                                  <span className="text-slate-500">Tickets Sold: </span>
                                  <span className="font-semibold text-slate-900">
                                    {event.totalSold || 0}/{event.totalTickets}
                                  </span>
                                  {event.totalTickets && event.totalSold === event.totalTickets && event.totalTickets > 0 && (
                                    <span className="ml-2 text-red-600 font-semibold">🔴 SOLD OUT</span>
                                  )}
                                </div>
                              )}
                              
                              {/* Show sold out ticket types */}
                              {event.tickets.some(t => t.sold === t.quantity && t.quantity > 0) && (
                                <div className="text-red-600 text-xs">
                                  {event.tickets
                                    .filter(t => t.sold === t.quantity && t.quantity > 0)
                                    .map(t => t.name)
                                    .join(', ')} sold out
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2 self-center">
                    <Link
                      href={`/my-events/${event.id}/sales`}
                      className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 text-center"
                    >
                      View Sales
                    </Link>
                    <Link
                      href={`/submit-event?id=${event.id}`}
                      className="px-4 py-2 rounded-lg bg-indigo-500 text-white font-semibold hover:bg-indigo-600 text-center transition-colors"
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/my-events/${event.id}/staff`}
                      className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 text-center transition-colors"
                    >
                      Staff
                    </Link>
                    {event.status === 'published' && (
                      <button
                        onClick={() => handleUnpublish(event.id)}
                        className="px-4 py-2 rounded-lg border border-amber-200 text-amber-700 font-semibold hover:bg-amber-50 transition-colors"
                      >
                        Unpublish
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteEvent(event.id, event.title)}
                      className="px-4 py-2 rounded-lg text-red-600 border border-red-200 hover:bg-red-50 font-semibold"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8">
          <Link
            href="/events"
            className="text-indigo-500 hover:text-indigo-600 font-semibold"
          >
            ← Back to Public Events
          </Link>
        </div>
      </div>
    </main>
  )
}
