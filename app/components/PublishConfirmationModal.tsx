import { useState } from 'react'

type Event = {
  id: number
  title: string
  description: string
  start_date: string
}

type PublishConfirmationModalProps = {
  event: Event
  onConfirm: () => Promise<void>
  onCancel: () => void
}

export default function PublishConfirmationModal({
  event,
  onConfirm,
  onCancel,
}: PublishConfirmationModalProps) {
  const [isPublishing, setIsPublishing] = useState(false)
  const [error, setError] = useState('')

  const handleConfirm = async () => {
    try {
      setIsPublishing(true)
      setError('')
      await onConfirm()
    } catch (err) {
      setError('Failed to publish event. Please try again.')
      console.error(err)
      setIsPublishing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Publish Event?</h2>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-900">
            <strong>Event:</strong> {event.title}
          </p>
          <p className="text-sm text-blue-900 mt-1">
            <strong>Date:</strong> {new Date(event.start_date).toLocaleDateString()}
          </p>
        </div>

        <p className="text-gray-600 mb-6">
          Once published, this event will be visible to the public and tickets can be purchased.
        </p>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 mb-6">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isPublishing}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-gray-900 font-semibold hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPublishing}
            className="flex-1 px-4 py-2 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 disabled:opacity-50"
          >
            {isPublishing ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  )
}
