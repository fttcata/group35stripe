'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import type { Event } from '../events/data'

const EventMapInner = dynamic(() => import('./EventMapInner'), {
  ssr: false,
  loading: () => (
    <div className="h-[576px] w-full overflow-hidden rounded-xl shadow-sm bg-gray-100 flex items-center justify-center">
      <span className="text-gray-500">Loading map...</span>
    </div>
  ),
})

type Props = {
  items: Event[]
}

export default function EventMap({ items }: Props) {
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

  // Stable key to prevent re-initialization
  const mapKey = useMemo(() => 'map-' + items.length, [items.length])

  return (
    <section className="py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h3 className="text-lg font-semibold mb-3">Event map</h3>
        <p className="text-sm text-gray-600 mb-4">Where our featured events take place.</p>

        <div className="h-[576px] w-full overflow-hidden rounded-xl shadow-sm" key={mapKey}>
          <EventMapInner items={items} center={center} />
        </div>
      </div>
    </section>
  )
}
