export type Event = {
  title: string
  description: string
  date: string // ISO date (YYYY-MM-DD)
  image: string
  location?: string
  distance?: string
  rating?: number
}

// Primary export: structured event objects
export const events: Event[] = [
  {
    title: 'NAME_PLACEHOLDER_01',
    description: 'DESC_PLACEHOLDER_01',
    date: '2026-02-10',
    image: '/events/event1.svg',
    location: 'LOCATION_PLACEHOLDER_01',
    distance: 'DISTANCE_PLACEHOLDER_01',
    rating: 0,
  },
  {
    title: 'NAME_PLACEHOLDER_02',
    description: 'DESC_PLACEHOLDER_02',
    date: '2026-03-05',
    image: '/events/event2.svg',
    location: 'LOCATION_PLACEHOLDER_02',
    distance: 'DISTANCE_PLACEHOLDER_02',
    rating: 0,
  },
  {
    title: 'NAME_PLACEHOLDER_03',
    description: 'DESC_PLACEHOLDER_03',
    date: '2026-04-12',
    image: '/events/event3.svg',
    location: 'LOCATION_PLACEHOLDER_03',
    distance: 'DISTANCE_PLACEHOLDER_03',
    rating: 0,
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
