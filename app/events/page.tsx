'use client'

import { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import EventCard from '../components/EventCard'
import { events as eventsData, type Event, type TicketType } from './data'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

const EventMap = dynamic(() => import('../components/EventMap'), { ssr: false })

const SPORT_CATEGORIES = ['Running', 'Football', 'Basketball', 'Tennis', 'Swimming', 'Cycling', 'Other'] as const

function monthKey(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleString('default', { month: 'long', year: 'numeric' })
}

function groupByMonth(items: Event[]) {
  const map: Record<string, Event[]> = {}
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date))
  for (const ev of sorted) {
    const key = monthKey(ev.date)
    if (!map[key]) map[key] = []
    map[key].push(ev)
  }
  return map
}

// Parse a YYYY-MM-DD string into a local-midnight Date (avoids UTC-offset bugs)
function parseLocalDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export default function EventsPage() {
  const [allEvents, setAllEvents] = useState<Event[]>(eventsData)
  const [loading, setLoading] = useState(true)

  // Filter state
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedLocation, setSelectedLocation] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    const loadEvents = async () => {
      const supabase = createSupabaseBrowserClient()

      const { data: dbEvents, error: dbError } = await supabase
        .from('events')
        .select('id,title,description,start_date,end_time,sport_category,venue,location_url,images')
        .eq('status', 'published')

      if (dbError) {
        console.error('Failed to load events:', dbError.message)
        setAllEvents(eventsData)
        setLoading(false)
        return
      }

      const eventIds = (dbEvents || []).map((e) => e.id)
      let ticketRows: Array<{ event_id: number; name: string; price: number }> = []

      if (eventIds.length > 0) {
        const { data: tickets, error: ticketError } = await supabase
          .from('ticket_types')
          .select('event_id,name,price')
          .in('event_id', eventIds)

        if (!ticketError && tickets) {
          ticketRows = tickets
        }
      }

      const ticketsByEventId = ticketRows.reduce<Record<number, TicketType[]>>((acc, row) => {
        if (!acc[row.event_id]) acc[row.event_id] = []
        acc[row.event_id].push({ name: row.name, price: row.price })
        return acc
      }, {})

      const mappedEvents: Event[] = (dbEvents || []).map((e) => {
        const startDate = new Date(e.start_date)
        const endDate = new Date(e.end_time)
        const slugBase = e.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
        return {
          slug: `${slugBase}-${e.id}`,
          title: e.title,
          description: e.description,
          date: startDate.toISOString().slice(0, 10),
          startTime: startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
          endTime: endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
          sportCategory: e.sport_category,
          image: e.images?.[0],
          location: e.venue,
          locationUrl: e.location_url || undefined,
          rating: 0,
          ticketTypes: ticketsByEventId[e.id] || [],
        }
      })

      setAllEvents([...eventsData, ...mappedEvents])
      setLoading(false)
    }

    loadEvents()
  }, [])

  // Derive unique locations for the location filter dropdown
  const uniqueLocations = useMemo(() => {
    const locs = allEvents
      .map((e) => e.location)
      .filter((l): l is string => !!l)
    return [...new Set(locs)].sort()
  }, [allEvents])

  // Apply filters
  const filteredEvents = useMemo(() => {
    const fromDate = dateFrom ? parseLocalDate(dateFrom) : null
    const toDate = dateTo ? parseLocalDate(dateTo) : null

    const results = allEvents.filter((ev) => {
      // Text search
      if (search) {
        const q = search.toLowerCase()
        const matches =
          ev.title.toLowerCase().includes(q) ||
          ev.description.toLowerCase().includes(q) ||
          (ev.location?.toLowerCase().includes(q) ?? false)
        if (!matches) return false
      }

      // Date range filter
      if (fromDate || toDate) {
        const evDate = parseLocalDate(ev.date)
        if (fromDate && evDate < fromDate) return false
        if (toDate && evDate > toDate) return false
      }

      // Category filter
      if (selectedCategories.length > 0) {
        if (!ev.sportCategory || !selectedCategories.includes(ev.sportCategory)) return false
      }

      // Location filter
      if (selectedLocation) {
        if (ev.location !== selectedLocation) return false
      }

      return true
    })

    return results
  }, [allEvents, search, dateFrom, dateTo, selectedCategories, selectedLocation])

  const grouped = groupByMonth(filteredEvents)

  const activeFilterCount =
    (search ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    selectedCategories.length +
    (selectedLocation ? 1 : 0)

  function clearFilters() {
    setSearch('')
    setDateFrom('')
    setDateTo('')
    setSelectedCategories([])
    setSelectedLocation('')
  }

  function formatDisplayDate(iso: string) {
    const [y, m, d] = iso.split('-')
    return `${d}-${m}-${y}`
  }

  function toggleCategory(cat: string) {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      {/* Top Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-end gap-4">
          <Link
            href="/my-events"
            className="text-sm text-purple-600 hover:text-purple-700 font-semibold px-4 py-2 rounded-lg hover:bg-purple-50"
          >
            My Events
          </Link>
          <Link
            href="/drafts"
            className="text-sm text-purple-600 hover:text-purple-700 font-semibold px-4 py-2 rounded-lg hover:bg-purple-50"
          >
            Drafts
          </Link>
          <Link
            href="/submit-event"
            className="text-sm bg-purple-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            + Create Event
          </Link>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-700 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative max-w-6xl mx-auto px-4 py-16 sm:py-24">
          <div className="text-center space-y-4">
            <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight">
              Upcoming Events
            </h1>
            <p className="text-xl sm:text-2xl text-purple-100 max-w-2xl mx-auto">
              Discover amazing events, workshops, and meetups near you
            </p>

          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-purple-50 to-transparent"></div>
      </div>

      {/* Filters Section */}
      <section className="max-w-6xl mx-auto px-4 pt-8 pb-2">
        {/* Search + Toggle Row */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {/* Search Input */}
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events by name, description, or location..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-700 placeholder-gray-400"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Filter Toggle Button */}
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl border shadow-sm font-medium transition-all ${
              filtersOpen || activeFilterCount > 0
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className={`text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ${
                filtersOpen ? 'bg-white text-purple-600' : 'bg-purple-600 text-white'
              }`}>
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Expanded Filters Panel */}
        {filtersOpen && (
          <div className="mt-4 bg-white rounded-2xl border border-gray-200 shadow-lg p-6 animate-fade-in-up space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Date From */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">To</label>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Location Filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">All Locations</option>
                  {uniqueLocations.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Clear Filters */}
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  disabled={activeFilterCount === 0}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Clear All Filters
                </button>
              </div>
            </div>

            {/* Sport Category Chips */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Sport Category</label>
              <div className="flex flex-wrap gap-2">
                {SPORT_CATEGORIES.map((cat) => {
                  const isActive = selectedCategories.includes(cat)
                  return (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-700'
                      }`}
                    >
                      {cat}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Event Count */}
            <div className="pt-2 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Displaying <span className="font-semibold text-purple-700">{filteredEvents.length}</span> event{filteredEvents.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        )}

        {/* Active Filter Tags */}
        {activeFilterCount > 0 && !filtersOpen && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500">Active filters:</span>
            {search && (
              <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm">
                &quot;{search}&quot;
                <button onClick={() => setSearch('')} className="hover:text-purple-900">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </span>
            )}
            {dateFrom && (
              <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
                From: {formatDisplayDate(dateFrom)}
                <button onClick={() => setDateFrom('')} className="hover:text-blue-900">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </span>
            )}
            {dateTo && (
              <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
                To: {formatDisplayDate(dateTo)}
                <button onClick={() => setDateTo('')} className="hover:text-blue-900">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </span>
            )}
            {selectedCategories.map((cat) => (
              <span key={cat} className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">
                {cat}
                <button onClick={() => toggleCategory(cat)} className="hover:text-green-900">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </span>
            ))}
            {selectedLocation && (
              <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm">
                {selectedLocation}
                <button onClick={() => setSelectedLocation('')} className="hover:text-orange-900">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </span>
            )}
            <button
              onClick={clearFilters}
              className="text-sm text-red-500 hover:text-red-700 font-medium ml-2"
            >
              Clear all
            </button>
          </div>
        )}
      </section>

      {/* Events + Map Section (two-column on md+) */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-600"></div>
          </div>
        )}

        {/* No results message */}
        {!loading && filteredEvents.length === 0 && (
          <div className="text-center py-16">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No events found</h3>
            <p className="text-gray-400 mb-4">Try adjusting your filters or search terms</p>
            <button
              onClick={clearFilters}
              className="px-6 py-2 bg-purple-600 text-white rounded-full font-medium hover:bg-purple-700 transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left: Events list (1/3) */}
          <div className="md:col-span-1 space-y-12">
            {Object.entries(grouped).map(([month, items], idx) => (
              <div 
                key={month}
                className="animate-fade-in-up"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full px-6 py-2 shadow-lg">
                    <h2 className="text-xl font-bold">{month}</h2>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-purple-300 to-transparent"></div>
                </div>
                <div className="flex flex-col gap-6">
                  {items.map((e, cardIdx) => (
                    <div 
                      key={e.title}
                      className="animate-fade-in-up w-full"
                      style={{ animationDelay: `${(idx * 100) + (cardIdx * 50)}ms` }}
                    >
                      <EventCard
                        slug={e.slug || e.title.toLowerCase().replace(/\s+/g, '-')}
                        title={e.title}
                        description={e.description}
                        date={e.date}
                        image={e.image}
                        location={e.location}
                        distance={e.distance}
                        rating={e.rating}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Right: Map (2/3) */}
          <aside className="md:col-span-2">
            <div className="sticky top-24">
              <EventMap items={filteredEvents} />
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}
