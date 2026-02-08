import EventCard from './EventCard'
import { events as eventsData } from '../events/data'
import { supabase } from '../../lib/supabaseClient'

function upcoming(items: any[], limit = 3) {
  return [...items].sort((a, b) => (String(a.date)).localeCompare(String(b.date))).slice(0, limit)
}

export default async function FeaturedEvents() {
  let items = eventsData

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, description, date, venue, images')
        .order('date', { ascending: true })
        .limit(3)

      if (!error && data) {
        items = data.map((r: any) => ({
          title: r.title,
          description: r.description,
          date: r.date ? new Date(r.date).toISOString().slice(0, 10) : '',
          image: Array.isArray(r.images) && r.images.length > 0 ? r.images[0] : undefined,
          location: r.venue,
        }))
      }
    } catch (err) {
      // fall back to static data
    }
  }

  const list = upcoming(items, 3)

  return (
    <section className="py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Featured Events</h2>
            <p className="text-sm text-gray-600">Hand-picked upcoming events you might like.</p>
          </div>
          <a href="/events" className="text-sm font-medium text-indigo-600 hover:underline">See all</a>
        </div>

        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {list.map((e: any) => (
            <EventCard
              key={e.title}
              slug={e.slug || (e.title ? e.title.toLowerCase().replace(/\s+/g, '-') : '')}
              title={e.title}
              description={e.description}
              date={e.date}
              image={e.image}
              location={e.location}
              distance={e.distance}
              rating={e.rating}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
