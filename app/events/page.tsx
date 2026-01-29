"use client"

import { useEffect, useState } from 'react'

type EventItem = {
  id: string
  title: string
  description?: string
  date: string
  venue?: string
  images?: string[]
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchEvents() {
      setLoading(true)
      try {
        const res = await fetch('/api/events')
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Failed to load events')
        setEvents(json.events)
      } catch (err: any) {
        setError(err.message || String(err))
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [])

  if (loading) return <div className="p-8">Loading events…</div>
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>
  if (!events || events.length === 0) return <div className="p-8">No events found.</div>

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Events</h1>
      <ul className="space-y-4">
        {events.map((ev) => (
          <li key={ev.id} className="border p-4 rounded">
            <h2 className="text-xl font-semibold">{ev.title}</h2>
            <p className="text-sm text-zinc-600">{new Date(ev.date).toLocaleString()}</p>
            <p className="mt-2">{ev.description}</p>
            <p className="mt-2 text-sm">Venue: {ev.venue}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
