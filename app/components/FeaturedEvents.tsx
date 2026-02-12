'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import EventCard from './EventCard'
import { events as eventsData, Event } from '../events/data'

export default function FeaturedEvents() {
  const [items, setItems] = useState<Event[]>(
    [...eventsData].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3)
  )

  useEffect(() => {
    async function fetchFeatured() {
      try {
        const res = await fetch('/api/events')
        if (res.ok) {
          const json = await res.json()
          if (json.events && json.events.length > 0) {
            const mapped: Event[] = json.events.map((ev: Record<string, unknown>) => ({
              slug: (ev.title as string).toLowerCase().replace(/\s+/g, '-'),
              title: ev.title as string,
              description: (ev.description as string) || '',
              date: (ev.date as string).slice(0, 10),
              image: Array.isArray(ev.images) && ev.images.length > 0
                ? ev.images[0]
                : 'https://placehold.co/600x400/6366f1/ffffff?text=Event',
              location: (ev.venue as string) || '',
            }))
            // Take the first 3 upcoming events
            const upcoming = mapped
              .sort((a, b) => a.date.localeCompare(b.date))
              .slice(0, 3)
            setItems(upcoming)
          }
        }
      } catch {
        // API unavailable — keep static fallback
      }
    }

    fetchFeatured()
  }, [])

  return (
    <section className="py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Featured Events</h2>
            <p className="text-sm text-gray-600">Hand-picked upcoming events you might like.</p>
          </div>
          <Link href="/events" className="text-sm font-medium text-indigo-600 hover:underline">See all</Link>
        </div>

        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {items.map((e) => (
            <EventCard
              key={e.title}
              slug={e.slug || e.title.toLowerCase().replace(/\s+/g, '-')}
              title={e.title}
              description={e.description}
              date={e.date}
              image={e.image}
              location={e.location}
              distance={e.distance}
              rating={e.rating}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
