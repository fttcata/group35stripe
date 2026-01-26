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
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-700 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative max-w-6xl mx-auto px-4 py-16 sm:py-24">
          <div className="text-center space-y-4">
            <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight">
              Upcoming Events
            </h1>
            <p className="text-xl sm:text-2xl text-purple-100 max-w-2xl mx-auto">
              Discover amazing events, workshops, and meetups near you
            </p>
            <div className="flex justify-center gap-4 pt-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-full px-6 py-2">
                <span className="font-semibold">{eventsData.length}</span> Events
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-full px-6 py-2">
                <span className="font-semibold">{Object.keys(grouped).length}</span> Months
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-purple-50 to-transparent"></div>
      </div>

      {/* Events Section */}
      <section className="max-w-6xl mx-auto px-4 py-12 space-y-12">
        {Object.entries(grouped).map(([month, items], idx) => (
          <div 
            key={month}
            className="animate-fade-in-up"
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full px-6 py-2 shadow-lg">
                <h2 className="text-xl font-bold">{month}</h2>
              </div>
              <div className="flex-1 h-px bg-gradient-to-r from-purple-300 to-transparent"></div>
            </div>
            <div className="flex flex-wrap justify-center gap-6">
              {items.map((e, cardIdx) => (
                <div 
                  key={e.title}
                  className="animate-fade-in-up w-full md:w-[calc(50%-0.75rem)] max-w-lg"
                  style={{ animationDelay: `${(idx * 100) + (cardIdx * 50)}ms` }}
                >
                  <EventCard
                    title={e.title}
                    description={e.description}
                    date={e.date}
                    image={e.image}
                    location={e.location}
                    distance={e.distance}
                    rating={e.rating}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}
