export type Event = {
  title: string
  description: string
  date: string // ISO date (YYYY-MM-DD)
  image?: string
  location?: string
  distance?: string
  rating?: number
  lat?: number
  lng?: number
}

// Primary export: structured event objects
export const events: Event[] = [
  {
    title: 'Dublin City Marathon',
    description: "Annual full marathon through Dublin city centre. A challenging 26.2-mile race showcasing landmarks and local support.",
    date: '2026-02-10',
    image: 'https://placehold.co/600x400/6366f1/ffffff?text=City+Marathon',
    location: 'Downtown Starting Line',
    distance: '26.2 miles',
    rating: 4.8,
    lat: 53.3498,
    lng: -6.2603,
  },
  {
    title: 'Cork Half Marathon',
    description: 'Scenic half marathon around Cork city and waterfront — great for experienced and emerging runners alike.',
    date: '2026-03-05',
    image: 'https://placehold.co/600x400/10b981/ffffff?text=Trail+Half+Marathon',
    location: 'Riverside Park Entrance',
    distance: '13.1 miles',
    rating: 4.9,
    lat: 51.8985,
    lng: -8.4756,
  },
  {
    title: 'Wicklow Trail Run',
    description: 'Trail running event in the Wicklow mountains with mixed terrain and stunning views—suitable for trail enthusiasts.',
    date: '2026-04-12',
    image: 'https://placehold.co/600x400/ec4899/ffffff?text=Color+Run+5K',
    location: 'Community Sports Complex',
    distance: '3.1 miles',
    rating: 4.6,
    lat: 52.9866,
    lng: -6.0416,
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
