import EventCard from './EventCard'
import { events as eventsData } from '../events/data'

function upcoming(limit = 3) {
  return [...eventsData].sort((a, b) => a.date.localeCompare(b.date)).slice(0, limit)
}

export default function FeaturedEvents() {
  const items = upcoming(3)

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
          {items.map((e) => (
            <EventCard
              key={e.title}
              slug={e.slug || e.title.toLowerCase().replace(/\s+/g, '-')}
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
