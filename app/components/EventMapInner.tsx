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
  const markersRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    if (!mapRef.current) {
      // Initialize map
      mapRef.current = L.map(containerRef.current).setView(center, 8)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapRef.current)

      markersRef.current = L.layerGroup().addTo(mapRef.current)
    } else {
      mapRef.current.setView(center, mapRef.current.getZoom())
    }

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markersRef.current = null
      }
    }
  }, [center])

  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return

    const markers = markersRef.current
    markers.clearLayers()

    items.forEach((it) => {
      if (it.lat !== undefined && it.lng !== undefined) {
        const marker = L.circleMarker([it.lat, it.lng], {
          radius: 8,
          color: '#7c3aed',
          fillColor: '#7c3aed',
          fillOpacity: 0.9
        }).addTo(markers)

        marker.bindPopup(`
          <div style="max-width: 200px;">
            <strong>${it.title}</strong>
            <div style="font-size: 12px; color: #666;">${it.location || ''}</div>
            <div style="font-size: 11px; color: #888; margin-top: 4px;">${it.date}</div>
          </div>
        `)
      }
    })
  }, [items])

  return <div ref={containerRef} className="h-full w-full" />
}
