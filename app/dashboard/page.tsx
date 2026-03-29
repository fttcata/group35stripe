'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

type DashboardEvent = {
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
  ticketTypes?: Array<{ id: string; name: string; price?: number; totalQuantity: number; sold: number }>
}

type RecentActivity = {
  orderId: string
  customerEmail: string
  eventTitle: string
  amount: number
  createdAt: string
  ticketCount: number
}

type DashboardData = {
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

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'published' | 'past'>('all')
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true)
        const supabase = createSupabaseBrowserClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          setError('Please sign in to view your dashboard')
          setLoading(false)
          return
        }

        if (user.user_metadata?.role !== 'organizer') {
          router.push('/')
          return
        }

        const res = await fetch('/api/dashboard', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        })
        if (!res.ok) {
          const errData = await res.json()
          setError(errData.error || 'Failed to load dashboard')
          return
        }

        const dashboardData = await res.json()
        setData(dashboardData)
      } catch (err) {
        setError('An error occurred while loading the dashboard')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [router])

  const now = new Date().toISOString()

  const filteredEvents = useMemo(() => {
    if (!data) return []
    switch (filterStatus) {
      case 'draft':
        return data.allEvents.filter(e => e.status === 'draft')
      case 'published':
        return data.allEvents.filter(e => e.status === 'published' && e.start_date >= now)
      case 'past':
        return data.allEvents.filter(e => e.start_date < now)
      default:
        return data.allEvents
    }
  }, [data, filterStatus, now])

  const filterCounts = useMemo(() => {
    if (!data) return { all: 0, draft: 0, published: 0, past: 0 }
    return {
      all: data.allEvents.length,
      draft: data.allEvents.filter(e => e.status === 'draft').length,
      published: data.allEvents.filter(e => e.status === 'published' && e.start_date >= now).length,
      past: data.allEvents.filter(e => e.start_date < now).length,
    }
  }, [data, now])

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center">
        <div className="text-gray-600">Loading your dashboard...</div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      </main>
    )
  }

  if (!data) return null

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Organizer Dashboard</h1>
            <p className="text-gray-600 mt-2">Overview of your events and sales</p>
          </div>
          <Link
            href="/submit-event"
            className="rounded-full bg-purple-600 text-white px-6 py-3 font-semibold hover:bg-purple-700"
          >
            + Create Event
          </Link>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow">
            <p className="text-gray-500 text-sm mb-1">Total Events</p>
            <p className="text-3xl font-bold text-gray-900">{data.summary.totalEvents}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow">
            <p className="text-gray-500 text-sm mb-1">Tickets Sold</p>
            <p className="text-3xl font-bold text-indigo-600">{data.summary.totalTicketsSold}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow">
            <p className="text-gray-500 text-sm mb-1">Total Revenue</p>
            <p className="text-3xl font-bold text-green-600">${data.summary.totalRevenue.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow">
            <p className="text-gray-500 text-sm mb-1">Tickets Remaining</p>
            <p className="text-3xl font-bold text-orange-600">{data.summary.totalTicketsRemaining}</p>
          </div>
        </div>

        {/* Upcoming Events */}
        {data.upcomingEvents.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Upcoming Events</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.upcomingEvents.map(event => (
                <div key={event.id} className="bg-white rounded-xl shadow overflow-hidden">
                  {event.images?.[0] && (
                    <img src={event.images[0]} alt={event.title} className="w-full h-40 object-cover" />
                  )}
                  <div className="p-5">
                    <h3 className="font-semibold text-gray-900 text-lg mb-1">{event.title}</h3>
                    <p className="text-sm text-gray-500 mb-3">
                      {new Date(event.start_date).toLocaleDateString(undefined, {
                        weekday: 'short', month: 'short', day: 'numeric'
                      })} &middot; {event.venue}
                    </p>
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>{event.ticketsSold}/{event.totalCapacity} tickets sold</span>
                      <span className="font-semibold text-green-600">${event.revenue.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full"
                        style={{
                          width: `${event.totalCapacity > 0
                            ? Math.min(100, (event.ticketsSold / event.totalCapacity) * 100)
                            : 0}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Two-column: Activity Feed + Events List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Sales */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Sales</h2>
              {data.recentActivity.length === 0 ? (
                <p className="text-gray-500 text-sm">No sales yet</p>
              ) : (
                <div className="space-y-3">
                  {data.recentActivity.map(activity => (
                    <div key={activity.orderId} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                        <span className="text-green-600 text-xs font-bold">$</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{activity.customerEmail}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {activity.eventTitle} &middot; {activity.ticketCount} ticket{activity.ticketCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-gray-900">${activity.amount.toFixed(2)}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(activity.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* All Events with Filters */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">All Events</h2>

              {/* Filter Tabs */}
              <div className="flex gap-2 mb-4 flex-wrap">
                {(['all', 'draft', 'published', 'past'] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                      filterStatus === status
                        ? status === 'draft' ? 'bg-yellow-500 text-white'
                        : status === 'published' ? 'bg-green-600 text-white'
                        : status === 'past' ? 'bg-gray-600 text-white'
                        : 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)} ({filterCounts[status]})
                  </button>
                ))}
              </div>

              {/* Events List */}
              {filteredEvents.length === 0 ? (
                <p className="text-gray-500 text-sm py-8 text-center">No events match this filter</p>
              ) : (
                <div className="space-y-3">
                  {filteredEvents.map(event => (
                    <div key={event.id} className="flex flex-col gap-2 p-4 rounded-lg border border-gray-100 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-4">
                      {event.images?.[0] ? (
                        <img src={event.images[0]} alt={event.title} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-gray-400 text-xs">No img</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 truncate">{event.title}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            event.start_date < now
                              ? 'bg-gray-100 text-gray-600'
                              : event.status === 'draft'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {event.start_date < now ? 'Past' : event.status === 'draft' ? 'Draft' : 'Published'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {new Date(event.start_date).toLocaleDateString()} &middot; {event.venue || 'No venue'}
                        </p>
                      </div>
                      <div className="text-right text-sm flex-shrink-0">
                        <p className="font-semibold text-gray-900">{event.ticketsSold}/{event.totalCapacity}</p>
                        <p className="text-xs text-gray-500">tickets</p>
                      </div>
                      <div className="text-right text-sm flex-shrink-0">
                        <p className="font-semibold text-green-600">${event.revenue.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">revenue</p>
                      </div>
                      <Link
                        href={`/submit-event?id=${event.id}`}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 flex-shrink-0"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => setExpandedEventId(expandedEventId === event.id ? null : event.id)}
                        className="ml-2 px-3 py-1.5 rounded-lg bg-gray-100 text-sm font-semibold hover:bg-gray-200"
                      >
                        {expandedEventId === event.id ? 'Hide analytics' : 'View analytics'}
                      </button>
                      </div>

                      {expandedEventId === event.id && (
                        <div className="mt-3 bg-gray-50 p-4 rounded border border-gray-100">
                          <h4 className="font-semibold text-gray-800 mb-2">Ticket breakdown</h4>
                          {event.ticketTypes && event.ticketTypes.length > 0 ? (
                            <div className="space-y-2">
                              {event.ticketTypes.map(tt => (
                                <div key={tt.id} className="flex justify-between items-center">
                                  <div>
                                    <p className="font-medium text-gray-900">{tt.name}</p>
                                    <p className="text-xs text-gray-500">Price: ${tt.price?.toFixed(2) || '0.00'}</p>
                                  </div>
                                  <div className="text-sm text-gray-700">
                                    <span className="font-semibold">{tt.sold}</span> / {tt.totalQuantity}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">No ticket type data available</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8">
          <Link
            href="/my-events"
            className="text-purple-600 hover:text-purple-700 font-semibold"
          >
            &larr; Manage Events
          </Link>
        </div>
      </div>
    </main>
  )
}
