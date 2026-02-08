import { supabase } from '../../lib/supabaseClient'
import EventsClient from './EventsClient'
import { events as eventsData } from './data'

export default async function EventsPage() {
  let events = eventsData

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, description, date, venue, images')
        .order('date', { ascending: true })

      if (!error && data) {
        events = data.map((r: any) => ({
          title: r.title,
          description: r.description,
          date: r.date ? new Date(r.date).toISOString().slice(0, 10) : '',
          image: Array.isArray(r.images) && r.images.length > 0 ? r.images[0] : undefined,
          location: r.venue,
        }))
      }
    } catch (err) {
      // fall back to static
    }
  }

  return <EventsClient initialEvents={events} />
}
