'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import type { Event } from '../events/data'

const EventMapInner = dynamic(() => import('./EventMapInner'), {
  ssr: false,
  loading: () => (
    <div className="h-144 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center">
      <span className="text-slate-500">Loading map...</span>
    </div>
  ),
})

type Props = {
  items: Event[]
  fullScreen?: boolean
}

export default function EventMap({ items, fullScreen }: Props) {
  const points = items.filter((i) => i.lat !== undefined && i.lng !== undefined)

  const center = useMemo(() => {
    if (points.length) {
      return [
        points.reduce((s, p) => s + (p.lat ?? 0), 0) / points.length,
        points.reduce((s, p) => s + (p.lng ?? 0), 0) / points.length
      ] as [number, number]
    }
    return [53.35, -6.26] as [number, number]
  }, [points])

  const mapKey = useMemo(() => 'map-' + items.length, [items.length])

  if (fullScreen) {
    return (
      <div>
        <p className="text-sm text-slate-500 mb-3">
          {points.length > 0
            ? `${points.length} event${points.length === 1 ? '' : 's'} pinned on the map. Click a marker to view details.`
            : 'No events with map coordinates to display.'}
        </p>
        <div className="h-[70vh] w-full overflow-hidden rounded-xl border border-slate-200 shadow-sm" key={mapKey}>
          <EventMapInner items={items} center={center} />
        </div>
      </div>
    )
  }

  return (
    <section className="py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h3 className="text-lg font-semibold mb-3">Event map</h3>
        <p className="text-sm text-slate-500 mb-4">
          {points.length > 0
            ? `Showing ${points.length} event${points.length === 1 ? '' : 's'} with map locations.`
            : 'No events with map coordinates to display. Events with a Google Maps link will appear here.'}
        </p>

        <div className="h-144 w-full overflow-hidden rounded-xl shadow-sm" key={mapKey}>
          <EventMapInner items={items} center={center} />
        </div>
      </div>
    </section>
  )
}
