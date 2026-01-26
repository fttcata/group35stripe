export type Event = {
  title: string
  description: string
  date: string // ISO date (YYYY-MM-DD)
  image?: string
  location?: string
  distance?: string
  rating?: number
}

// Primary export: structured event objects
export const events: Event[] = [
  {
    title: 'City Marathon 2026',
    description: 'Annual full marathon through downtown streets. A challenging 26.2-mile course showcasing our city\'s most iconic landmarks and neighborhoods.',
    date: '2026-02-10',
    location: 'Downtown Starting Line',
    distance: '26.2 miles',
    rating: 4.8,
  },
  {
    title: 'Spring Trail Half Marathon',
    description: 'Scenic half marathon winding through beautiful forest trails and riverside paths. Perfect for runners seeking a mix of challenge and natural beauty.',
    date: '2026-03-05',
    image: '/events/event2.svg',
    location: 'Riverside Park Entrance',
    distance: '13.1 miles',
    rating: 4.9,
  },
  {
    title: 'Charity 5K Color Run',
    description: 'Fun family-friendly 5K featuring color stations along the route. All proceeds benefit local children\'s hospitals. Walkers welcome!',
    date: '2026-04-12',
    image: '/events/event3.svg',
    location: 'Community Sports Complex',
    distance: '3.1 miles',
    rating: 4.6,
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
