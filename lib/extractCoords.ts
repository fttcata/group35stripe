/**
 * Attempt to extract latitude and longitude from a Google Maps URL.
 *
 * Supported URL formats:
 *  - https://www.google.com/maps/place/.../@53.3498,-6.2603,15z/...
 *  - https://www.google.com/maps/@53.3498,-6.2603,15z
 *  - https://maps.google.com/?q=53.3498,-6.2603
 *  - https://www.google.com/maps?ll=53.3498,-6.2603
 *  - https://www.google.com/maps/search/53.3498,-6.2603
 *  - https://www.google.com/maps?q=53.3498,-6.2603
 *
 * Returns { lat, lng } or null if coordinates cannot be extracted.
 */
export function extractCoordsFromGoogleMapsUrl(
  url: string
): { lat: number; lng: number } | null {
  if (!url) return null

  try {
    // Pattern 1: /@lat,lng   (most common for shared links)
    const atSignMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/)
    if (atSignMatch) {
      const lat = parseFloat(atSignMatch[1])
      const lng = parseFloat(atSignMatch[2])
      if (isValidCoord(lat, lng)) return { lat, lng }
    }

    // Pattern 2: ?q=lat,lng  or &q=lat,lng
    const qMatch = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/)
    if (qMatch) {
      const lat = parseFloat(qMatch[1])
      const lng = parseFloat(qMatch[2])
      if (isValidCoord(lat, lng)) return { lat, lng }
    }

    // Pattern 3: ?ll=lat,lng  or &ll=lat,lng
    const llMatch = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/)
    if (llMatch) {
      const lat = parseFloat(llMatch[1])
      const lng = parseFloat(llMatch[2])
      if (isValidCoord(lat, lng)) return { lat, lng }
    }

    // Pattern 4: /search/lat,lng
    const searchMatch = url.match(/\/search\/(-?\d+\.?\d*),(-?\d+\.?\d*)/)
    if (searchMatch) {
      const lat = parseFloat(searchMatch[1])
      const lng = parseFloat(searchMatch[2])
      if (isValidCoord(lat, lng)) return { lat, lng }
    }

    // Pattern 5: /place/lat,lng (without @)
    const placeMatch = url.match(/\/place\/(-?\d+\.?\d*),(-?\d+\.?\d*)/)
    if (placeMatch) {
      const lat = parseFloat(placeMatch[1])
      const lng = parseFloat(placeMatch[2])
      if (isValidCoord(lat, lng)) return { lat, lng }
    }
  } catch {
    // Malformed URL — ignore
  }

  return null
}

function isValidCoord(lat: number, lng: number): boolean {
  return (
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  )
}
