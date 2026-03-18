import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

type EventRow = {
  id: string
  title: string
  description: string | null
  start_date: string
  venue: string | null
  status: 'draft' | 'published'
}

function isOrganizerRole(role: unknown) {
  if (typeof role !== 'string') return false
  const normalized = role.trim().toLowerCase()
  return normalized === 'organizer' || normalized === 'organiser'
}

function formatDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Date TBA'
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default async function OrganizerCommandCenterPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirectTo=/organizer')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role,full_name')
    .eq('id', user.id)
    .maybeSingle()

  if (!isOrganizerRole(profile?.role || user.user_metadata?.role)) {
    redirect('/')
  }

  const { data: events } = await supabase
    .from('events')
    .select('id,title,description,start_date,venue,status')
    .eq('created_by', user.id)
    .order('start_date', { ascending: true })

  const allEvents = (events || []) as EventRow[]
  const now = new Date()

  const published = allEvents.filter((e) => e.status === 'published')
  const drafts = allEvents.filter((e) => e.status === 'draft')
  const upcoming = allEvents.filter((e) => new Date(e.start_date) >= now)

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <section className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Organizer Workspace</p>
          <h1 className="mt-2 text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">Command Center</h1>
          <p className="mt-3 text-slate-600 max-w-2xl">
            Welcome back{profile?.full_name ? `, ${profile.full_name}` : ''}. This workspace is focused on creating, publishing, and operating your events.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/submit-event"
              className="rounded-lg bg-slate-900 text-white px-5 py-3 text-sm font-semibold hover:bg-slate-700"
            >
              Create Event
            </Link>
            <Link
              href="/my-events"
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Manage Events
            </Link>
            <Link
              href="/organizer/insights"
              className="rounded-lg border border-blue-300 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-800 hover:bg-blue-100"
            >
              Open Insights
            </Link>
            <Link
              href="/staff"
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              Open Staff Scanner
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Total Events</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{allEvents.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Published</p>
          <p className="mt-1 text-3xl font-bold text-emerald-700">{published.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Upcoming</p>
          <p className="mt-1 text-3xl font-bold text-blue-700">{upcoming.length}</p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-12">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Your Event Pipeline</h2>
            <span className="text-xs font-semibold rounded-full bg-amber-100 text-amber-800 px-3 py-1">
              {drafts.length} draft{drafts.length !== 1 ? 's' : ''}
            </span>
          </div>

          {allEvents.length === 0 && (
            <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-slate-600">No events yet. Start your first event to begin building your calendar.</p>
            </div>
          )}

          {allEvents.length > 0 && (
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {allEvents.map((event) => (
                <article key={event.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{event.title}</h3>
                      <p className="text-sm text-slate-500 mt-1">{formatDate(event.start_date)}</p>
                      <p className="text-sm text-slate-500">{event.venue || 'Venue TBA'}</p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        event.status === 'published'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {event.status === 'published' ? 'Published' : 'Draft'}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 mt-3 line-clamp-2">{event.description || 'No description yet.'}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href="/my-events"
                      className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Manage
                    </Link>
                    {event.status === 'published' && (
                      <Link
                        href={`/my-events/${event.id}/staff`}
                        className="rounded-md border border-cyan-300 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-100"
                      >
                        Manage Staff
                      </Link>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
