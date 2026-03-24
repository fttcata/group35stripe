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
              slug: `${(ev.title as string).toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}-${String(ev.id || '')}`,
              title: ev.title as string,
              description: (ev.description as string) || '',
              date: (ev.date as string).slice(0, 10),
              image: Array.isArray(ev.images) && ev.images.length > 0
                ? ev.images[0]
                : 'https://placehold.co/600x400/6366f1/ffffff?text=Event',
              location: (ev.venue as string) || '',
              lat: typeof ev.lat === 'number' ? ev.lat : undefined,
              lng: typeof ev.lng === 'number' ? ev.lng : undefined,
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
    <section className="py-16 sm:py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-500 uppercase tracking-wide mb-2">Don&apos;t miss out</p>
            <h2 className="text-3xl font-bold text-slate-900">Featured Events</h2>
            <p className="mt-2 text-slate-500">Hand-picked upcoming events you won&apos;t want to miss.</p>
          </div>
          <Link href="/events" className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-indigo-500 hover:text-indigo-600 transition-colors">
            View all
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </Link>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

        <div className="mt-8 text-center sm:hidden">
          <Link href="/events" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-500 hover:text-indigo-600">
            View all events
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </Link>
        </div>
      </div>
    </section>
  )
}
