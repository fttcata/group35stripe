'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import PublishConfirmationModal from '../components/PublishConfirmationModal'

type DraftEvent = {
  id: number
  title: string
  description: string
  start_date: string
  sport_category: string
  venue: string
  images: string[]
}

export default function DraftsPage() {
  const router = useRouter()
  const [draftEvents, setDraftEvents] = useState<DraftEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [publishingId, setPublishingId] = useState<number | null>(null)
  const [selectedDraft, setSelectedDraft] = useState<DraftEvent | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)

  useEffect(() => {
    loadDrafts()
  }, [])

  const loadDrafts = async () => {
    try {
      setLoading(true)
      const supabase = createSupabaseBrowserClient()

      const { data, error: dbError } = await supabase
        .from('events')
        .select('id,title,description,start_date,sport_category,venue,images')
        .eq('status', 'draft')
        .order('created_at', { ascending: false })

      if (dbError) {
        setError('Failed to load draft events')
        console.error(dbError)
        return
      }

      setDraftEvents(data || [])
    } catch (err) {
      setError('An error occurred while loading drafts')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handlePublishClick = (draft: DraftEvent) => {
    setSelectedDraft(draft)
    setShowConfirmation(true)
  }

  const handlePublishConfirm = async () => {
    if (!selectedDraft) return

    try {
      setPublishingId(selectedDraft.id)
      const supabase = createSupabaseBrowserClient()

      // Update event status to published
      const { error: updateError } = await supabase
        .from('events')
        .update({ status: 'published' })
        .eq('id', selectedDraft.id)

      if (updateError) {
        setError('Failed to publish event')
        console.error(updateError)
        setPublishingId(null)
        setShowConfirmation(false)
        return
      }

      // Redirect to events page where the published event now appears
      router.push('/events')
    } catch (err) {
      setError('An error occurred while publishing')
      console.error(err)
      setPublishingId(null)
      setShowConfirmation(false)
    }
  }

  const handleDeleteDraft = async (id: number) => {
    if (!confirm('Are you sure you want to delete this draft?')) return

    try {
      const supabase = createSupabaseBrowserClient()

      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .eq('id', id)

      if (deleteError) {
        setError('Failed to delete draft')
        console.error(deleteError)
        return
      }

      setDraftEvents(draftEvents.filter(e => e.id !== id))
    } catch (err) {
      setError('An error occurred while deleting')
      console.error(err)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center">
        <div className="text-gray-600">Loading your drafts...</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex justify-between items-center mb-8">
          <Link href="/events" className="text-sm text-purple-700 hover:text-purple-900">
            ← Back to Events
          </Link>
          <Link href="/my-events" className="text-sm text-purple-700 hover:text-purple-900 font-semibold">
            My Events
          </Link>
        </div>

        <div className="mt-8 bg-white rounded-2xl shadow-lg p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Draft Events</h1>
              <p className="text-gray-600 mt-1">Manage your unpublished events</p>
            </div>
            <Link
              href="/submit-event"
              className="rounded-full bg-purple-600 text-white px-6 py-3 font-semibold hover:bg-purple-700"
            >
              + New Event
            </Link>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-6">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {draftEvents.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">No draft events yet</p>
              <Link
                href="/submit-event"
                className="text-purple-600 hover:text-purple-700 font-semibold"
              >
                Create your first event
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {draftEvents.map((draft) => (
                <div
                  key={draft.id}
                  className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex gap-6">
                    {draft.images?.[0] && (
                      <img
                        src={draft.images[0]}
                        alt={draft.title}
                        className="w-24 h-24 rounded-lg object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{draft.title}</h3>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{draft.description}</p>
                      <div className="flex gap-4 mt-3 text-sm text-gray-500">
                        <span>{new Date(draft.start_date).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{draft.sport_category}</span>
                        <span>•</span>
                        <span>{draft.venue}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 self-center">
                      <button
                        onClick={() => handlePublishClick(draft)}
                        disabled={publishingId === draft.id}
                        className="px-4 py-2 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 disabled:opacity-50"
                      >
                        Publish
                      </button>
                      <button
                        onClick={() => handleDeleteDraft(draft.id)}
                        className="px-4 py-2 rounded-lg text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showConfirmation && selectedDraft && (
        <PublishConfirmationModal
          event={selectedDraft}
          onConfirm={handlePublishConfirm}
          onCancel={() => {
            setShowConfirmation(false)
            setSelectedDraft(null)
          }}
        />
      )}
    </main>
  )
}
