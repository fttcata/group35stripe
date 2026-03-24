export type TicketType = {
  id?: string
  name: string
  price: number
  quantity?: number
  sold?: number
}

export type Event = {
  slug?: string
  title: string
  description: string
  date: string // ISO date (YYYY-MM-DD)
  startTime?: string
  endTime?: string
  sportCategory?: 'Running' | 'Football' | 'Basketball' | 'Tennis' | 'Swimming' | 'Cycling' | 'Other'
  image?: string
  images?: string[]
  location?: string
  locationUrl?: string
  distance?: string
  rating?: number
  lat?: number
  lng?: number
  ticketTypes?: TicketType[]
  totalAvailable?: number
  totalSold?: number
  createdAt?: string
}

// Primary export: structured event objects
export const events: Event[] = []
