'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Event } from '../events/data'

type Props = {
  items: Event[]
  center: [number, number]
}

export default function EventMapInner({ items, center }: Props) {
  const mapRef = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // Initialize map
    mapRef.current = L.map(containerRef.current).setView(center, 8)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapRef.current)

    // Add markers
    items.forEach((it) => {
      if (it.lat !== undefined && it.lng !== undefined && mapRef.current) {
        const marker = L.circleMarker([it.lat, it.lng], {
          radius: 8,
          color: '#7c3aed',
          fillColor: '#7c3aed',
          fillOpacity: 0.9
        }).addTo(mapRef.current)

        const slug = it.slug || it.title.toLowerCase().replace(/\s+/g, '-')

        marker.bindPopup(`
          <div style="max-width: 200px;">
            <strong>${it.title}</strong>
            <div style="font-size: 12px; color: #666;">${it.location || ''}</div>
            <div style="font-size: 11px; color: #888; margin-top: 4px;">${it.date}</div>
            <a href="/eventDetails?slug=${encodeURIComponent(slug)}" style="display:inline-block;margin-top:8px;padding:4px 12px;background:#7c3aed;color:#fff;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none;">View Event</a>
          </div>
        `)
      }
    })

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, []) // Empty deps - only run once

  return <div ref={containerRef} className="h-full w-full" />
}
