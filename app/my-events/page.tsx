'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

type EventManagement = {
  id: number
  title: string
  description: string
  start_date: string
  sport_category: string
  venue: string
  images: string[]
  status: 'draft' | 'published'
}

export default function MyEventsPage() {
  const router = useRouter()
  const [allEvents, setAllEvents] = useState<EventManagement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'published'>('all')

  useEffect(() => {
    loadAllEvents()
  }, [])

  const loadAllEvents = async () => {
    try {
      setLoading(true)
      const supabase = createSupabaseBrowserClient()

      const { data, error: dbError } = await supabase
        .from('events')
        .select('id,title,description,start_date,sport_category,venue,images,status')
        .order('created_at', { ascending: false })

      if (dbError) {
        setError('Failed to load events')
        console.error(dbError)
        return
      }

      setAllEvents(data || [])
    } catch (err) {
      setError('An error occurred while loading events')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteEvent = async (id: number, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return

    try {
      const supabase = createSupabaseBrowserClient()

      // Delete event and its associated ticket types (cascade should handle this)
      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .eq('id', id)

      if (deleteError) {
        setError('Failed to delete event')
        console.error(deleteError)
        return
      }

      setAllEvents(allEvents.filter(e => e.id !== id))
    } catch (err) {
      setError('An error occurred while deleting')
      console.error(err)
    }
  }

  const handleUnpublish = async (id: number) => {
    try {
      const supabase = createSupabaseBrowserClient()

      const { error: updateError } = await supabase
        .from('events')
        .update({ status: 'draft' })
        .eq('id', id)

      if (updateError) {
        setError('Failed to unpublish event')
        console.error(updateError)
        return
      }

      setAllEvents(allEvents.map(e => e.id === id ? { ...e, status: 'draft' } : e))
    } catch (err) {
      setError('An error occurred')
      console.error(err)
    }
  }

  const filteredEvents = filterStatus === 'all' 
    ? allEvents 
    : allEvents.filter(e => e.status === filterStatus)

  const draftCount = allEvents.filter(e => e.status === 'draft').length
  const publishedCount = allEvents.filter(e => e.status === 'published').length

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center">
        <div className="text-gray-600">Loading your events...</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">My Events</h1>
            <p className="text-gray-600 mt-2">Manage all your events in one place</p>
          </div>
          <Link
            href="/submit-event"
            className="rounded-full bg-purple-600 text-white px-6 py-3 font-semibold hover:bg-purple-700"
          >
            + Create Event
          </Link>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg p-6 shadow">
            <p className="text-gray-600 text-sm mb-1">Total Events</p>
            <p className="text-3xl font-bold text-gray-900">{allEvents.length}</p>
          </div>
          <div className="bg-white rounded-lg p-6 shadow">
            <p className="text-gray-600 text-sm mb-1">Drafts</p>
            <p className="text-3xl font-bold text-yellow-600">{draftCount}</p>
          </div>
          <div className="bg-white rounded-lg p-6 shadow">
            <p className="text-gray-600 text-sm mb-1">Published</p>
            <p className="text-3xl font-bold text-green-600">{publishedCount}</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-lg font-semibold ${
              filterStatus === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-900 border border-gray-200'
            }`}
          >
            All ({allEvents.length})
          </button>
          <button
            onClick={() => setFilterStatus('draft')}
            className={`px-4 py-2 rounded-lg font-semibold ${
              filterStatus === 'draft'
                ? 'bg-yellow-500 text-white'
                : 'bg-white text-gray-900 border border-gray-200'
            }`}
          >
            Drafts ({draftCount})
          </button>
          <button
            onClick={() => setFilterStatus('published')}
            className={`px-4 py-2 rounded-lg font-semibold ${
              filterStatus === 'published'
                ? 'bg-green-600 text-white'
                : 'bg-white text-gray-900 border border-gray-200'
            }`}
          >
            Published ({publishedCount})
          </button>
        </div>

        {/* Events List */}
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-600 mb-4">No {filterStatus === 'all' ? '' : filterStatus} events yet</p>
            <Link
              href="/submit-event"
              className="text-purple-600 hover:text-purple-700 font-semibold"
            >
              Create your first event
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                className="bg-white rounded-lg p-6 shadow hover:shadow-lg transition-shadow"
              >
                <div className="flex gap-6">
                  {event.images?.[0] && (
                    <img
                      src={event.images[0]}
                      alt={event.title}
                      className="w-32 h-32 rounded-lg object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{event.title}</h3>
                          <span
                            className={`text-xs px-3 py-1 rounded-full font-semibold ${
                              event.status === 'draft'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {event.status === 'draft' ? 'Draft' : 'Published'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{event.description}</p>
                        <div className="flex gap-4 text-sm text-gray-500">
                          <span>{new Date(event.start_date).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>{event.sport_category}</span>
                          <span>•</span>
                          <span>{event.venue}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2 self-center">
                    <Link
                      href={`/submit-event?id=${event.id}`}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 text-center"
                    >
                      Edit
                    </Link>
                    {event.status === 'published' && (
                      <button
                        onClick={() => handleUnpublish(event.id)}
                        className="px-4 py-2 rounded-lg bg-orange-500 text-white font-semibold hover:bg-orange-600"
                      >
                        Unpublish
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteEvent(event.id, event.title)}
                      className="px-4 py-2 rounded-lg text-red-600 border border-red-200 hover:bg-red-50 font-semibold"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8">
          <Link
            href="/events"
            className="text-purple-600 hover:text-purple-700 font-semibold"
          >
            ← Back to Public Events
          </Link>
        </div>
      </div>
    </main>
  )
}
