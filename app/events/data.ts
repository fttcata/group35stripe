export type TicketType = {
  name: string
  price: number
}

export type Event = {
  slug: string
  title: string
  description: string
  date: string // ISO date (YYYY-MM-DD)
  startTime: string // HH:MM format
  endTime: string // HH:MM format
  sportCategory: 'Running' | 'Football' | 'Basketball' | 'Tennis' | 'Swimming' | 'Cycling' | 'Other'
  image?: string
  location?: string
  locationUrl?: string // Google Maps or other navigation URL
  distance?: string
  rating?: number
  ticketTypes: TicketType[] // Array of ticket types with prices
}

// Primary export: structured event objects
export const events: Event[] = [
  {
    slug: 'city-marathon-2026',
    title: 'City Marathon 2026',
    description: 'Annual full marathon through downtown streets. A challenging 26.2-mile course showcasing our city\'s most iconic landmarks and neighborhoods.',
    date: '2026-02-10',
    startTime: '07:00',
    endTime: '14:00',
    sportCategory: 'Running',
    image: 'https://picsum.photos/600/400?random=1',
    location: 'Downtown Starting Line',
    locationUrl: 'https://maps.google.com',
    distance: '26.2 miles',
    rating: 4.8,
    ticketTypes: [
      { name: 'General', price: 45 },
      { name: 'Student', price: 30 },
      { name: 'Over 60s', price: 25 },
    ],
  },
  {
    slug: 'spring-trail-half-marathon',
    title: 'Spring Trail Half Marathon',
    description: 'Scenic half marathon winding through beautiful forest trails and riverside paths. Perfect for runners seeking a mix of challenge and natural beauty.',
    date: '2026-03-05',
    startTime: '08:00',
    endTime: '12:00',
    sportCategory: 'Running',
    image: 'https://picsum.photos/600/400?random=2',
    location: 'Riverside Park Entrance',
    locationUrl: 'https://maps.google.com',
    distance: '13.1 miles',
    rating: 4.9,
    ticketTypes: [
      { name: 'General', price: 35 },
      { name: 'Student', price: 25 },
    ],
  },
  {
    slug: 'charity-5k-color-run',
    title: 'Charity 5K Color Run',
    description: 'Fun family-friendly 5K featuring color stations along the route. All proceeds benefit local children\'s hospitals. Walkers welcome!',
    date: '2026-04-12',
    startTime: '09:00',
    endTime: '11:00',
    sportCategory: 'Running',
    image: 'https://picsum.photos/600/400?random=3',
    location: 'Community Sports Complex',
    locationUrl: 'https://maps.google.com',
    distance: '3.1 miles',
    rating: 4.6,
    ticketTypes: [
      { name: 'Full Price', price: 20 },
    ],
  },
]

// Alternative compact representation (tuples) and a small mapper.
// Use this if you prefer a tighter literal format and want to expand later.
//
// export const rawEvents: [string, string, string, string, string?, string?, number?][] = [
//   ['2026-02-10', 'Stripe Meetup: Payments 101', 'Intro to building payments with Stripe and modern webapps.', '/events/event1.svg', 'London, GB', '—', 4.8],
//   ['2026-03-05', 'Design Systems Workshop', 'Hands-on workshop on design tokens and component libraries.', '/events/event2.svg', 'Manchester, GB', '—', 4.6],
//   ['2026-04-12', 'Next.js & Tailwind Deep Dive', 'Building fast UI with Next.js App Router and Tailwind CSS.', '/events/event3.svg', 'Brighton, GB', '—', 4.9],
// ]
//
// export const events = rawEvents.map(([date, title, description, image, location, distance, rating]) => ({
//   date, title, description, image, location, distance, rating,
// }))
