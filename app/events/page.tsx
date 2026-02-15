'use client'

import { useEffect, useState } from 'react'
import EventCard from '../components/EventCard'
import { events as eventsData, type Event, type TicketType } from './data'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

function monthKey(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleString('default', { month: 'long', year: 'numeric' })
}

function groupByMonth(items: typeof eventsData) {
  const map: Record<string, typeof eventsData> = {}
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date))
  for (const ev of sorted) {
    const key = monthKey(ev.date)
    if (!map[key]) map[key] = []
    map[key].push(ev)
  }
  return map
}

export default function EventsPage() {
  const [allEvents, setAllEvents] = useState(eventsData)
  const [selectedCategory, setSelectedCategory] = useState<string>('All')

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
    }

    loadEvents()
  }, [])

  // Filter events by category
  const filteredEvents = selectedCategory === 'All' 
    ? allEvents 
    : allEvents.filter(e => e.sportCategory === selectedCategory)

  const grouped = groupByMonth(filteredEvents)

  // Get unique categories
  const categories = ['All', ...Array.from(new Set(allEvents.map(e => e.sportCategory)))]

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
            <div className="flex justify-center gap-4 pt-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-full px-6 py-2">
                <span className="font-semibold">{filteredEvents.length}</span> Events
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-full px-6 py-2">
                <span className="font-semibold">{Object.keys(grouped).length}</span> Months
              </div>
            </div>
            <div className="pt-4">
              <Link
                href="/submit-event"
                className="inline-flex items-center justify-center rounded-full bg-white text-purple-600 px-8 py-3 font-semibold hover:bg-gray-100 transition-colors"
              >
                + Submit Your Event
              </Link>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-purple-50 to-transparent"></div>
      </div>

      {/* Filter Section */}
      <section className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Filter by Sport Category</h3>
          <div className="flex flex-wrap gap-3">
            {categories.map((category, idx) => (
              <button
                key={`${category}-${idx}`}
                onClick={() => setSelectedCategory(category)}
                className={`px-6 py-2 rounded-full font-semibold transition-all ${
                  selectedCategory === category
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Events Section */}
      <section className="max-w-6xl mx-auto px-4 py-12 space-y-12">
        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-12">
            <p className="text-xl text-gray-600">No events found for this category.</p>
          </div>
        ) : (
          Object.entries(grouped).map(([month, items], idx) => (
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
            <div className="flex flex-wrap justify-center gap-6">
              {items.map((e, cardIdx) => (
                <div 
                  key={`${e.slug}-${cardIdx}`}
                  className="animate-fade-in-up w-full md:w-[calc(50%-0.75rem)] max-w-lg"
                  style={{ animationDelay: `${(idx * 100) + (cardIdx * 50)}ms` }}
                >
                  <EventCard
                    slug={e.slug}
                    title={e.title}
                    description={e.description}
                    date={e.date}
                    startTime={e.startTime}
                    endTime={e.endTime}
                    sportCategory={e.sportCategory}
                    image={e.image}
                    location={e.location}
                    distance={e.distance}
                    rating={e.rating}
                    ticketTypes={e.ticketTypes}
                  />
                </div>
              ))}
            </div>
          </div>
        )))}
      </section>
    </main>
  )
}
