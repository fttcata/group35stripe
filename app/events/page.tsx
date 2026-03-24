'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { events as eventsData, type Event, type TicketType } from './data'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

const EventMap = dynamic(() => import('../components/EventMap'), { ssr: false })

const CATEGORIES = ['Running', 'Football', 'Basketball', 'Tennis', 'Swimming', 'Cycling', 'Other'] as const

type SortOption = 'date' | 'alpha' | 'posted' | 'type'

// Fuzzy search: split query into words, each word must match at least one field
function fuzzyMatch(query: string, event: Event): boolean {
  if (!query.trim()) return true
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const haystack = [
    event.title,
    event.description,
    event.location ?? '',
    event.sportCategory ?? '',
  ].join(' ').toLowerCase()

  return words.every(word => haystack.includes(word))
}

function parseLocalDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function isOrganizerRole(role: unknown) {
  if (typeof role !== 'string') return false
  const normalized = role.trim().toLowerCase()
  return normalized === 'organizer' || normalized === 'organiser'
}

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  } catch {
    return d
  }
}

export default function EventsPage() {
  const [allEvents, setAllEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [isOrganizerView, setIsOrganizerView] = useState(false)

  // View: list or map
  const [view, setView] = useState<'list' | 'map'>('list')

  // Search & filter state
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('date')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    const loadEvents = async () => {
      const supabase = createSupabaseBrowserClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      let organizerMode = false
      if (user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()

        organizerMode = isOrganizerRole(profile?.role || user.user_metadata?.role)
      }

      setIsOrganizerView(organizerMode)

      const baseQuery = supabase
        .from('events')
        .select('id,title,description,start_date,end_time,sport_category,venue,location_url,images,lat,lng,status,created_by,created_at')

      const scopedQuery = organizerMode && user?.id
        ? baseQuery.eq('created_by', user.id)
        : baseQuery.eq('status', 'published')

      const { data: dbEvents, error: dbError } = await scopedQuery

      if (dbError) {
        console.error('Failed to load events:', dbError.message)
        setAllEvents(eventsData)
        setLoading(false)
        return
      }

      const eventIds = (dbEvents || []).map((e) => e.id)

      // Fetch ticket types with quantity
      let ticketRows: Array<{ event_id: string; id: string; name: string; price: number; quantity?: number }> = []
      if (eventIds.length > 0) {
        const { data: tickets, error: ticketError } = await supabase
          .from('ticket_types')
          .select('event_id,id,name,price,quantity')
          .in('event_id', eventIds)

        if (!ticketError && tickets) {
          ticketRows = tickets
        }
      }

      // Compute total available per event
      const ticketsByEventId: Record<string, TicketType[]> = {}
      const availableByEvent: Record<string, number> = {}
      for (const row of ticketRows) {
        if (!ticketsByEventId[row.event_id]) ticketsByEventId[row.event_id] = []
        ticketsByEventId[row.event_id].push({ id: row.id, name: row.name, price: row.price, quantity: row.quantity ?? 0 })
        availableByEvent[row.event_id] = (availableByEvent[row.event_id] || 0) + (row.quantity ?? 0)
      }

      // Compute sold tickets per event (count tickets via orders)
      const soldByEvent: Record<string, number> = {}
      if (eventIds.length > 0) {
        const { data: completedOrders } = await supabase
          .from('orders')
          .select('id, event_id')
          .eq('payment_status', 'completed')
          .in('event_id', eventIds)

        if (completedOrders && completedOrders.length > 0) {
          const orderIds = completedOrders.map(o => o.id)
          const orderToEvent: Record<string, string> = {}
          completedOrders.forEach(o => { orderToEvent[o.id] = o.event_id })

          const { data: soldTickets } = await supabase
            .from('tickets')
            .select('order_id')
            .in('order_id', orderIds)

          soldTickets?.forEach(t => {
            const eid = orderToEvent[t.order_id]
            if (eid) soldByEvent[eid] = (soldByEvent[eid] || 0) + 1
          })
        }
      }

      const mappedEvents: Event[] = (dbEvents || []).map((e) => {
        const startDate = new Date(e.start_date)
        const endDate = new Date(e.end_time)
        const slugBase = e.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
        const totalAvail = availableByEvent[e.id] || 0
        const totalSold = soldByEvent[e.id] || 0
        return {
          slug: `${slugBase}-${e.id}`,
          title: e.title,
          description: e.description,
          date: startDate.toISOString().slice(0, 10),
          startTime: startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
          endTime: endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
          sportCategory: e.sport_category,
          image: e.images?.[0],
          images: e.images ?? [],
          location: e.venue,
          locationUrl: e.location_url || undefined,
          lat: typeof e.lat === 'number' ? e.lat : undefined,
          lng: typeof e.lng === 'number' ? e.lng : undefined,
          rating: 0,
          ticketTypes: ticketsByEventId[e.id] || [],
          totalAvailable: totalAvail,
          totalSold: totalSold,
          createdAt: e.created_at,
        }
      })

      setAllEvents(organizerMode ? mappedEvents : [...eventsData, ...mappedEvents])
      setLoading(false)
    }

    loadEvents()
  }, [])

  // Apply filters + search + sort
  const filteredEvents = useMemo(() => {
    const fromDate = dateFrom ? parseLocalDate(dateFrom) : null
    const toDate = dateTo ? parseLocalDate(dateTo) : null

    let results = allEvents.filter((ev) => {
      if (!fuzzyMatch(search, ev)) return false
      if (fromDate || toDate) {
        const evDate = parseLocalDate(ev.date)
        if (fromDate && evDate < fromDate) return false
        if (toDate && evDate > toDate) return false
      }
      if (selectedCategory && ev.sportCategory !== selectedCategory) return false
      return true
    })

    // Sort
    results = [...results].sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return a.date.localeCompare(b.date)
        case 'alpha':
          return a.title.localeCompare(b.title)
        case 'posted':
          return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
        case 'type':
          return (a.sportCategory ?? '').localeCompare(b.sportCategory ?? '')
        default:
          return 0
      }
    })

    return results
  }, [allEvents, search, dateFrom, dateTo, selectedCategory, sortBy])

  const activeFilterCount =
    (search ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (selectedCategory ? 1 : 0)

  const clearFilters = useCallback(() => {
    setSearch('')
    setDateFrom('')
    setDateTo('')
    setSelectedCategory('')
  }, [])

  // ─── Organizer view (unchanged) ───────────────────────────
  if (isOrganizerView) {
    const today = new Date()
    const publishedCount = allEvents.filter((e: any) => e.status === 'published').length
    const draftCount = allEvents.filter((e: any) => e.status === 'draft').length
    const upcomingCount = allEvents.filter((e) => {
      const eventDate = new Date(e.date)
      return !Number.isNaN(eventDate.getTime()) && eventDate >= today
    }).length

    return (
      <main className="min-h-screen bg-linear-to-br from-slate-950 via-cyan-950 to-slate-900 text-slate-100">
        <section className="max-w-6xl mx-auto px-4 py-10">
          <div className="rounded-3xl border border-cyan-500/20 bg-slate-900/70 backdrop-blur p-8 shadow-[0_24px_80px_rgba(6,182,212,0.18)]">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Organizer View</p>
            <h1 className="mt-2 text-4xl sm:text-5xl font-black bg-linear-to-r from-cyan-200 to-emerald-200 bg-clip-text text-transparent">
              Event Command Center
            </h1>
            <p className="mt-3 max-w-2xl text-slate-300">
              You can only view and manage your own events from here.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/submit-event" className="rounded-xl bg-linear-to-r from-cyan-400 to-emerald-300 text-slate-950 font-bold px-5 py-3 hover:from-cyan-300 hover:to-emerald-200">
                Create Event
              </Link>
              <Link href="/my-events" className="rounded-xl border border-cyan-400/40 bg-cyan-500/10 text-cyan-100 font-semibold px-5 py-3 hover:bg-cyan-500/20">
                Open Full Event Manager
              </Link>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5">
              <p className="text-sm text-slate-400">Total Events</p>
              <p className="mt-1 text-3xl font-black text-slate-100">{allEvents.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5">
              <p className="text-sm text-slate-400">Published</p>
              <p className="mt-1 text-3xl font-black text-emerald-300">{publishedCount}</p>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5">
              <p className="text-sm text-slate-400">Upcoming</p>
              <p className="mt-1 text-3xl font-black text-cyan-300">{upcomingCount}</p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-slate-700 bg-slate-900/80 p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold">Your Events</h2>
              {draftCount > 0 && (
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-600/20 border border-amber-500/40 text-amber-300">
                  {draftCount} draft{draftCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {loading && (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-400"></div>
              </div>
            )}

            {!loading && allEvents.length === 0 && (
              <div className="mt-6 rounded-xl border border-slate-700 bg-slate-950/60 p-8 text-center">
                <p className="text-slate-300">No events yet. Start by creating your first event.</p>
              </div>
            )}

            {!loading && allEvents.length > 0 && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                {allEvents.map((e) => (
                  <div key={e.slug} className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-slate-100">{e.title}</h3>
                        <p className="text-sm text-slate-400 mt-1">{formatDate(e.date)}</p>
                        <p className="text-sm text-slate-400">{e.location || 'Location TBA'}</p>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${(e as any).status === 'draft' ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40' : 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'}`}>
                        {(e as any).status === 'draft' ? 'Draft' : 'Published'}
                      </span>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Link href="/my-events" className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">
                        Manage
                      </Link>
                      <Link href="/submit-event" className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/20">
                        Create New
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    )
  }

  // ─── Public events view ───────────────────────────────────
  return (
    <main className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-slate-900 text-white">
        <div aria-hidden className="absolute inset-0 bg-linear-to-br from-indigo-600/15 via-transparent to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="text-indigo-400 font-semibold text-sm tracking-wide uppercase mb-2">Explore</p>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Upcoming Events
              </h1>
              <p className="mt-2 text-slate-400 max-w-lg">
                Discover amazing events, workshops, and meetups near you
              </p>
            </div>
            {isOrganizerView && (
              <div className="flex gap-2">
                <Link href="/my-events" className="text-sm font-medium text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors">My Events</Link>
                <Link href="/drafts" className="text-sm font-medium text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors">Drafts</Link>
                <Link href="/submit-event" className="text-sm font-medium bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2 rounded-lg transition-colors">+ Create Event</Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar: Search + Sort + Map toggle */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-2">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events, locations, categories..."
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-700 placeholder-slate-400"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-4 py-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="date">Sort: Date (soonest)</option>
            <option value="alpha">Sort: A – Z</option>
            <option value="posted">Sort: Recently posted</option>
            <option value="type">Sort: Event type</option>
          </select>

          {/* Filters Toggle */}
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg border font-medium text-sm transition-all ${
              filtersOpen || activeFilterCount > 0
                ? 'bg-indigo-500 text-white border-indigo-500'
                : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center bg-white text-indigo-600">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Map / List Toggle */}
          <button
            onClick={() => setView(view === 'list' ? 'map' : 'list')}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg border font-medium text-sm transition-all ${
              view === 'map'
                ? 'bg-indigo-500 text-white border-indigo-500'
                : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
            }`}
          >
            {view === 'list' ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                View on Map
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                Back to List
              </>
            )}
          </button>
        </div>

        {/* Expanded Filters */}
        {filtersOpen && (
          <div className="mt-4 bg-white rounded-xl border border-slate-200 p-6 animate-slide-down space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">From</label>
                <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">To</label>
                <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div className="flex items-end">
                <button onClick={clearFilters} disabled={activeFilterCount === 0} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Clear All
                </button>
              </div>
            </div>

            {/* Category chips */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">Category</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCategory('')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    !selectedCategory ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'
                  }`}
                >
                  All
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(selectedCategory === cat ? '' : cat)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedCategory === cat ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <p className="text-sm text-slate-500">
                Showing <span className="font-semibold text-indigo-600">{filteredEvents.length}</span> event{filteredEvents.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        )}

        {/* Active filter pills */}
        {activeFilterCount > 0 && !filtersOpen && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-500">Active:</span>
            {search && (
              <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-sm">
                &quot;{search}&quot;
                <button onClick={() => setSearch('')} className="hover:text-indigo-900">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </span>
            )}
            {selectedCategory && (
              <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-sm">
                {selectedCategory}
                <button onClick={() => setSelectedCategory('')} className="hover:text-indigo-900">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </span>
            )}
            <button onClick={clearFilters} className="text-sm text-red-500 hover:text-red-700 font-medium ml-2">Clear all</button>
          </div>
        )}
      </section>

      {/* Content: list or map */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        {loading && (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        )}

        {!loading && filteredEvents.length === 0 && (
          <div className="text-center py-20">
            <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className="text-xl font-semibold text-slate-600 mb-2">No events found</h3>
            <p className="text-slate-400 mb-4">Try adjusting your search or filters</p>
            <button onClick={clearFilters} className="px-6 py-2.5 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600 transition-colors">
              Clear All Filters
            </button>
          </div>
        )}

        {!loading && filteredEvents.length > 0 && view === 'map' && (
          <div className="mt-6">
            <EventMap items={filteredEvents} fullScreen />
          </div>
        )}

        {!loading && filteredEvents.length > 0 && view === 'list' && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-slate-500 mb-4">
              {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
            </p>
            {filteredEvents.map((e, idx) => {
              const slug = e.slug || e.title.toLowerCase().replace(/\s+/g, '-')
              const minPrice = e.ticketTypes && e.ticketTypes.length > 0
                ? Math.min(...e.ticketTypes.map(t => t.price))
                : null
              const totalAvail = e.totalAvailable ?? 0
              const totalSold = e.totalSold ?? 0
              const remaining = totalAvail - totalSold
              const hasRealStats = e.totalAvailable !== undefined && e.totalAvailable > 0
              const sellingFast = hasRealStats && remaining > 0 && remaining <= totalAvail * 0.2

              return (
                <Link
                  key={slug}
                  href={`/eventDetails?slug=${encodeURIComponent(slug)}`}
                  className="block group"
                  aria-label={`View details for ${e.title}`}
                >
                  <article
                    className="bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all duration-200 overflow-hidden animate-fade-in-up"
                    style={{ animationDelay: `${idx * 30}ms` }}
                  >
                    <div className="flex flex-col sm:flex-row">
                      {/* Thumbnail */}
                      <div className="relative w-full sm:w-52 h-44 sm:h-auto shrink-0 bg-slate-100">
                        {e.image ? (
                          <Image
                            src={e.image}
                            alt={e.title}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 100vw, 208px"
                            unoptimized
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          </div>
                        )}
                        {/* Category badge overlaying the image */}
                        {e.sportCategory && (
                          <span className="absolute top-2 left-2 text-xs font-semibold text-white bg-indigo-600/85 backdrop-blur-sm px-2.5 py-1 rounded-lg">
                            {e.sportCategory}
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 p-5 flex flex-col justify-between min-w-0">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
                            <span className="font-medium text-indigo-600">{formatDate(e.date)}</span>
                            {e.startTime && e.endTime && (
                              <span>· {e.startTime} – {e.endTime}</span>
                            )}
                          </div>

                          <h3 className="text-lg font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                            {e.title}
                          </h3>

                          <p className="text-sm text-slate-500 line-clamp-2">{e.description}</p>

                          <div className="flex items-center gap-4 text-sm text-slate-500 pt-1">
                            {e.location && (
                              <span className="flex items-center gap-1 truncate">
                                <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {e.location}
                              </span>
                            )}
                            {e.distance && (
                              <span className="flex items-center gap-1 shrink-0">
                                <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                                {e.distance}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Bottom row: price + stats */}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                          <div className="flex items-center gap-3">
                            {minPrice !== null && (
                              <span className="text-base font-bold text-slate-900">From &euro;{minPrice}</span>
                            )}
                            {e.ticketTypes && e.ticketTypes.length > 1 && (
                              <span className="text-xs text-slate-400">· {e.ticketTypes.length} types</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {hasRealStats && remaining <= 0 && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded">
                                Sold out
                              </span>
                            )}
                            {sellingFast && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" /></svg>
                                Selling fast!
                              </span>
                            )}
                            {hasRealStats && remaining > 0 && (
                              <span className="text-xs text-slate-400">
                                {remaining} ticket{remaining !== 1 ? 's' : ''} left
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
