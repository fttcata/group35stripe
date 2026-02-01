'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type TicketType = {
  name: string
  price: number
}

const SPORT_CATEGORIES = ['Running', 'Football', 'Basketball', 'Tennis', 'Swimming', 'Cycling', 'Other'] as const

export default function SubmitEventPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    startTime: '',
    endTime: '',
    sportCategory: 'Running' as typeof SPORT_CATEGORIES[number],
    location: '',
    locationUrl: '',
    distance: '',
    image: '',
  })
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([{ name: 'General', price: 0 }])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleTicketChange = (index: number, field: 'name' | 'price', value: string) => {
    const updated = [...ticketTypes]
    if (field === 'price') {
      updated[index][field] = parseFloat(value) || 0
    } else {
      updated[index][field] = value
    }
    setTicketTypes(updated)
  }

  const addTicketType = () => {
    setTicketTypes([...ticketTypes, { name: '', price: 0 }])
  }

  const removeTicketType = (index: number) => {
    if (ticketTypes.length > 1) {
      setTicketTypes(ticketTypes.filter((_, i) => i !== index))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      // Validate form
      if (!formData.title || !formData.description || !formData.date || !formData.location || !formData.startTime || !formData.endTime) {
        setError('Please fill in all required fields')
        setIsSubmitting(false)
        return
      }

      // Validate ticket types
      const validTickets = ticketTypes.filter(t => t.name.trim() && t.price > 0)
      if (validTickets.length === 0) {
        setError('Please add at least one valid ticket type with a price')
        setIsSubmitting(false)
        return
      }

      // Generate slug from title
      const slug = formData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '') + '-' + Date.now()

      // Create event object
      const newEvent = {
        slug,
        title: formData.title,
        description: formData.description,
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        sportCategory: formData.sportCategory,
        location: formData.location,
        locationUrl: formData.locationUrl || undefined,
        distance: formData.distance || undefined,
        image: formData.image || undefined,
        rating: 0,
        ticketTypes: validTickets,
      }

      // Get existing events from localStorage
      const existingEvents = JSON.parse(localStorage.getItem('submittedEvents') || '[]')
      
      // Add new event
      const updatedEvents = [...existingEvents, newEvent]
      
      // Save to localStorage
      localStorage.setItem('submittedEvents', JSON.stringify(updatedEvents))

      // Clear form
      setFormData({
        title: '',
        description: '',
        date: '',
        startTime: '',
        endTime: '',
        sportCategory: 'Running',
        location: '',
        locationUrl: '',
        distance: '',
        image: '',
      })
      setTicketTypes([{ name: 'General', price: 0 }])

      // Redirect to events page
      router.push('/events')
    } catch (err) {
      setError('Failed to submit event. Please try again.')
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href="/events" className="text-sm text-purple-700 hover:text-purple-900">
          ← Back to Events
        </Link>

        <div className="mt-8 bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Submit New Event</h1>
          <p className="text-gray-600 mb-6">Create and share your event with the community</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-red-800">{error}</p>
              </div>
            )}

            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-semibold text-gray-900 mb-2">
                Event Title *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g., Community Marathon 2026"
                className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-semibold text-gray-900 mb-2">
                Description *
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe your event in detail..."
                rows={4}
                className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                required
              />
            </div>

            {/* Date */}
            <div>
              <label htmlFor="date" className="block text-sm font-semibold text-gray-900 mb-2">
                Event Date *
              </label>
              <input
                type="date"
                id="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                required
              />
            </div>

            {/* Start and End Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="startTime" className="block text-sm font-semibold text-gray-900 mb-2">
                  Start Time *
                </label>
                <input
                  type="time"
                  id="startTime"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                  required
                />
              </div>
              <div>
                <label htmlFor="endTime" className="block text-sm font-semibold text-gray-900 mb-2">
                  End Time *
                </label>
                <input
                  type="time"
                  id="endTime"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                  required
                />
              </div>
            </div>

            {/* Sport Category */}
            <div>
              <label htmlFor="sportCategory" className="block text-sm font-semibold text-gray-900 mb-2">
                Sport Category *
              </label>
              <select
                id="sportCategory"
                name="sportCategory"
                value={formData.sportCategory}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                required
              >
                {SPORT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            {/* Location */}
            <div>
              <label htmlFor="location" className="block text-sm font-semibold text-gray-900 mb-2">
                Location *
              </label>
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="e.g., Central Park, Downtown"
                className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                required
              />
            </div>

            {/* Location URL */}
            <div>
              <label htmlFor="locationUrl" className="block text-sm font-semibold text-gray-900 mb-2">
                Location URL (Google Maps link) *
              </label>
              <input
                type="url"
                id="locationUrl"
                name="locationUrl"
                value={formData.locationUrl}
                onChange={handleChange}
                placeholder="https://maps.google.com/..."
                className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                required
              />
            </div>

            {/* Distance */}
            <div>
              <label htmlFor="distance" className="block text-sm font-semibold text-gray-900 mb-2">
                Distance (optional)
              </label>
              <input
                type="text"
                id="distance"
                name="distance"
                value={formData.distance}
                onChange={handleChange}
                placeholder="e.g., 26.2 miles"
                className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
              />
            </div>

            {/* Image URL */}
            <div>
              <label htmlFor="image" className="block text-sm font-semibold text-gray-900 mb-2">
                Image URL (optional)
              </label>
              <input
                type="url"
                id="image"
                name="image"
                value={formData.image}
                onChange={handleChange}
                placeholder="https://example.com/image.jpg"
                className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
              />
            </div>

            {/* Ticket Types */}
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-900">
                Ticket Types & Prices *
              </label>
              {ticketTypes.map((ticket, index) => (
                <div key={index} className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Ticket name (e.g., General, Student)"
                    value={ticket.name}
                    onChange={(e) => handleTicketChange(index, 'name', e.target.value)}
                    className="flex-1 rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                    required
                  />
                  <input
                    type="number"
                    placeholder="Price"
                    min="0"
                    step="0.01"
                    value={ticket.price || ''}
                    onChange={(e) => handleTicketChange(index, 'price', e.target.value)}
                    className="w-32 rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                    required
                  />
                  {ticketTypes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTicketType(index)}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addTicketType}
                className="text-sm text-purple-600 hover:text-purple-700 font-semibold"
              >
                + Add Another Ticket Type
              </button>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-full bg-purple-600 text-white py-3 font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Event'}
              </button>
              <Link
                href="/events"
                className="flex-1 rounded-full border border-gray-200 text-gray-900 py-3 font-semibold text-center hover:bg-gray-50"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}
