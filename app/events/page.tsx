import EventCard from '../components/EventCard'
import { events as eventsData } from './data'

function monthKey(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleString('default', { month: 'long', year: 'numeric' })
}

function groupByMonth(items: typeof eventsData) {
  const map: Record<string, typeof eventsData> = {}
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date))
  for (const ev of sorted) {
    const key = monthKey(ev.date)
    if (!map[key]) map[key] = []
    map[key].push(ev)
  }
  return map
}

export default function EventsPage() {
  const grouped = groupByMonth(eventsData)

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Events</h1>
        <p className="text-gray-600 mt-2">Description</p>
      </header>

      <section className="space-y-8">
        {Object.entries(grouped).map(([month, items]) => (
          <div key={month}>
            <h2 className="text-2xl font-semibold mb-4">{month}</h2>
            <div className="grid gap-6 md:grid-cols-2">
              {items.map((e) => (
                <EventCard
                  key={e.title}
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
        ))}
      </section>
    </main>
  )
}
