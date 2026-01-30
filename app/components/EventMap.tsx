'use client'

import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import type { Event } from '../events/data'

type Props = {
  items: Event[]
}

export default function EventMap({ items }: Props) {
  const points = items.filter((i) => i.lat !== undefined && i.lng !== undefined) as Required<Pick<Event, 'lat'|'lng'>>[]

  const center = points.length
    ? [points.reduce((s, p) => s + (p.lat ?? 0), 0) / points.length, points.reduce((s, p) => s + (p.lng ?? 0), 0) / points.length]
    : [53.35, -6.26]

  return (
    <section className="py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h3 className="text-lg font-semibold mb-3">Event map</h3>
        <p className="text-sm text-gray-600 mb-4">Where our featured events take place.</p>

        <div className="h-72 w-full overflow-hidden rounded-xl shadow-sm">
          <MapContainer {...({ center: center as [number, number], zoom: 8, scrollWheelZoom: false, className: 'h-full w-full' } as any)}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {items.map((it) =>
              it.lat !== undefined && it.lng !== undefined ? (
                <CircleMarker
                  key={it.title}
                  {...({ center: [it.lat, it.lng], radius: 8, pathOptions: { color: '#7c3aed', fillColor: '#7c3aed', fillOpacity: 0.9 } } as any)}
                >
                  <Popup>
                    <div className="max-w-xs">
                      <strong className="block">{it.title}</strong>
                      <div className="text-sm text-gray-600">{it.location}</div>
                      <div className="text-xs text-gray-500 mt-1">{it.date}</div>
                    </div>
                  </Popup>
                </CircleMarker>
              ) : null
            )}
          </MapContainer>
        </div>
      </div>
    </section>
  )
}
