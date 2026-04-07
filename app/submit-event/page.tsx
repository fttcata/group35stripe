'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import PublishConfirmationModal from '../components/PublishConfirmationModal'
import { extractCoordsFromGoogleMapsUrl } from '@/lib/extractCoords'

export const dynamic = 'force-dynamic'

type TicketType = {
  name: string
  price: number
  quantity: number
  id?: number
  sold?: number
}

const SPORT_CATEGORIES = ['Running', 'Football', 'Basketball', 'Tennis', 'Swimming', 'Cycling', 'Other'] as const

export default function SubmitEventPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const eventId = searchParams.get('id')
  const openedFromAdmin = searchParams.get('from') === 'admin'
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    startTime: '',
    endTime: '',
    sportCategory: 'Running' as typeof SPORT_CATEGORIES[number],
    location: '',
    locationUrl: '',
    image: '',
  })
  const [extractedCoords, setExtractedCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [showLocationHelp, setShowLocationHelp] = useState(false)
  const [originalEventData, setOriginalEventData] = useState<Record<string, string> | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([{ name: 'General', price: 0, quantity: 0 }])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(!!eventId)
  const [error, setError] = useState('')
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [pendingPublish, setPendingPublish] = useState(false)
  const [publishSuccess, setPublishSuccess] = useState(false)
  const [dateWarning, setDateWarning] = useState('')
  const [venueWarning, setVenueWarning] = useState('')
  const [saveNotice, setSaveNotice] = useState('')
  const [roleChecked, setRoleChecked] = useState(false)
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [isAdminUser, setIsAdminUser] = useState(false)
  const isEditing = !!eventId
  const editReturnPath = (openedFromAdmin || isAdminUser) ? '/admin?tab=events' : '/my-events'

  // Role guard — organizers and admins may create/edit events
  useEffect(() => {
    const checkRole = async () => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setRoleChecked(true); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      const dbRole = String(profile?.role || '').trim().toLowerCase()
      const metaRole = String(user.user_metadata?.role || '').trim().toLowerCase()
      const email = String(user.email || '').trim().toLowerCase()
      const canManageEvents =
        dbRole === 'admin' ||
        dbRole === 'administrator' ||
        metaRole === 'admin' ||
        metaRole === 'administrator' ||
        dbRole === 'organizer' ||
        dbRole === 'organiser' ||
        metaRole === 'organizer' ||
        metaRole === 'organiser' ||
        email === 'admin@group35.com'
      const isAdmin =
        dbRole === 'admin' ||
        dbRole === 'administrator' ||
        metaRole === 'admin' ||
        metaRole === 'administrator' ||
        email === 'admin@group35.com'
      setIsOrganizer(canManageEvents)
      setIsAdminUser(isAdmin)
      setRoleChecked(true)
    }
    checkRole()
  }, [])

  // Load event data for editing
  useEffect(() => {
    if (!isEditing) return
    loadEventForEdit()
  }, [eventId])

  // Detect changes in date/venue
  useEffect(() => {
    if (!originalEventData) return
    
    const dateChanged = 
      originalEventData.date !== formData.date || 
      originalEventData.startTime !== formData.startTime
    const venueChanged = originalEventData.location !== formData.location

    if (dateChanged) {
      setDateWarning('⚠️ Changing the event date/time will notify all ticket holders.')
    } else {
      setDateWarning('')
    }

    if (venueChanged) {
      setVenueWarning('⚠️ Changing the venue will notify all ticket holders.')
    } else {
      setVenueWarning('')
    }
  }, [formData, originalEventData])

  const loadEventForEdit = async () => {
    try {
      const supabase = createSupabaseBrowserClient()

      // Fetch event data
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id,title,description,start_date,end_time,sport_category,venue,location_url,images,status')
        .eq('id', eventId)
        .single()

      if (eventError || !event) {
        setError('Failed to load event for editing')
        setIsLoading(false)
        return
      }

      // Reset to prevent duplicate rows if load runs again
      setTicketTypes([{ name: 'General', price: 0, quantity: 0 }])

      // Fetch ticket types - try with quantity field first
      let tickets: { id?: number; name: string; price: number; quantity?: number; sold?: number }[] = []
      let ticketError
      
      const { data: ticketsWithQty, error: errorWithQty } = await supabase
        .from('ticket_types')
        .select('id,name,price,quantity_available,quantity')
        .eq('event_id', eventId)

      if (errorWithQty) {
        // If quantity_available doesn't exist, try legacy quantity
        const { data: ticketsNoQty, error: errorNoQty } = await supabase
          .from('ticket_types')
          .select('id,name,price,quantity')
          .eq('event_id', eventId)
        
        if (errorNoQty) {
          console.warn('Failed to load ticket types:', errorNoQty)
          tickets = []
          ticketError = errorNoQty
        } else {
          // Convert to include quantity field with default value
          tickets = (ticketsNoQty || []).map(t => ({ ...t, quantity: t.quantity || 0 }))
        }
      } else {
        tickets = (ticketsWithQty || []).map(t => ({
          ...t,
          quantity: t.quantity_available ?? t.quantity ?? 0,
        }))
      }

      // Fetch sold ticket counts for each ticket type
      const ticketTypesData: TicketType[] = []
      
      if (tickets && tickets.length > 0) {
        for (const ticket of tickets) {
          let soldCount = 0
          
          try {
            // Try to query tickets table to count sold tickets
            const { data: soldTickets } = await supabase
              .from('tickets')
              .select('id', { count: 'exact', head: false })
              .eq('ticket_type_id', ticket.id)

            soldCount = soldTickets?.length || 0
          } catch {
            // Tickets table might not exist yet - continue without sold count
            console.debug(`Tickets table not available, sold count will be 0`)
          }

          ticketTypesData.push({
            id: ticket.id,
            name: ticket.name,
            price: ticket.price,
            quantity: ticket.quantity || 0,
            sold: soldCount,
          })
        }
      }

      // Parse event dates
      const startDate = new Date(event.start_date)
      const endDate = new Date(event.end_time)
      const dateStr = startDate.toISOString().slice(0, 10)
      const startTimeStr = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      const endTimeStr = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })

      const newFormData = {
        title: event.title,
        description: event.description,
        date: dateStr,
        startTime: startTimeStr,
        endTime: endTimeStr,
        sportCategory: event.sport_category as typeof SPORT_CATEGORIES[number],
        location: event.venue,
        locationUrl: event.location_url || '',
        image: event.images?.[0] || '',
        status: event.status || 'draft',
      }

      setFormData(newFormData)
      setOriginalEventData(newFormData)
      
      setTicketTypes(ticketTypesData.length > 0 ? ticketTypesData : [{ name: 'General', price: 0, quantity: 0 }])
    } catch (err) {
      setError('Failed to load event')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-extract coordinates when locationUrl changes
  useEffect(() => {
    if (formData.locationUrl) {
      const coords = extractCoordsFromGoogleMapsUrl(formData.locationUrl)
      setExtractedCoords(coords)
    } else {
      setExtractedCoords(null)
    }
  }, [formData.locationUrl])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleTicketChange = (index: number, field: 'name' | 'price' | 'quantity', value: string) => {
    const updated = [...ticketTypes]
    if (field === 'price' || field === 'quantity') {
      const numValue = parseFloat(value) || 0
      updated[index][field] = numValue
    } else {
      updated[index][field] = value
    }
    setTicketTypes(updated)
  }

  const addTicketType = () => {
    setTicketTypes([...ticketTypes, { name: '', price: 0, quantity: 0 }])
  }

  const removeTicketType = (index: number) => {
    // Prevent removing ticket types if edited and has sells
    if (isEditing && ticketTypes[index].sold && ticketTypes[index].sold > 0) {
      setError(`Cannot remove ticket type "${ticketTypes[index].name}" as ${ticketTypes[index].sold} tickets have already been sold.`)
      return
    }
    
    if (ticketTypes.length > 1) {
      setTicketTypes(ticketTypes.filter((_, i) => i !== index))
    }
  }

  const validateRequiredFields = (): boolean => {
    if (!formData.title || !formData.description || !formData.date || !formData.location || !formData.startTime || !formData.endTime) {
      setError('Please fill in all required fields')
      return false
    }

    // Google Maps link is required so the event appears on the map
    if (!formData.locationUrl) {
      setError('Please provide a Google Maps link so your event can be shown on the map')
      return false
    }

    const coords = extractCoordsFromGoogleMapsUrl(formData.locationUrl)
    if (!coords) {
      setError('Could not extract coordinates from the Google Maps link. Please provide a valid link containing coordinates.')
      return false
    }

    // Only validate date is in the future for new events, not when editing
    if (!isEditing) {
      const eventDateTime = new Date(`${formData.date}T${formData.startTime}`)
      if (eventDateTime <= new Date()) {
        setError('Event date must be in the future')
        return false
      }
    }

    return true
  }

  const validateTicketTypes = (): boolean => {
    const validTickets = ticketTypes.filter(t => t.name.trim() && t.price > 0 && t.quantity > 0)
    if (validTickets.length === 0) {
      setError('Please add at least one valid ticket type with a price and quantity')
      return false
    }
    return true
  }

  const handleSubmit = async (e?: React.FormEvent | null, publish: boolean = false) => {
    if (e && e.preventDefault) {
      e.preventDefault()
    }
    setError('')
    setSaveNotice('')
    setIsSubmitting(true)

    try {
      // Validate form
      if (!validateRequiredFields()) {
        setIsSubmitting(false)
        return
      }

      // If publishing, validate ticket types
      if (publish && !validateTicketTypes()) {
        setIsSubmitting(false)
        return
      }

      const eventDateTime = new Date(`${formData.date}T${formData.startTime}`)
      const endDateTime = new Date(`${formData.date}T${formData.endTime}`)

      // Initialize Supabase client
      const supabase = createSupabaseBrowserClient()
      const { data: authData } = await supabase.auth.getUser()
      const currentUserId = authData.user?.id || null

      let imageUrl = originalEventData?.image || ''

      // Upload image if new file provided
      if (imageFile) {
        const filename = `${Date.now()}-${imageFile.name}`
        const { error: uploadError } = await supabase.storage
          .from('event-images')
          .upload(filename, imageFile)

        if (uploadError) {
          setError(`Failed to upload image: ${uploadError.message}`)
          setIsSubmitting(false)
          return
        }

        const { data: { publicUrl } } = supabase.storage
          .from('event-images')
          .getPublicUrl(filename)

        imageUrl = publicUrl
      }

      // Extract coordinates from Google Maps URL if provided
      const coords = formData.locationUrl
        ? extractCoordsFromGoogleMapsUrl(formData.locationUrl)
        : null

      if (isEditing) {
        // UPDATE existing event
        const { error: updateError } = await supabase
          .from('events')
          .update({
            title: formData.title,
            description: formData.description,
            start_date: eventDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            sport_category: formData.sportCategory,
            venue: formData.location,
            location_url: formData.locationUrl || null,
            lat: coords?.lat ?? null,
            lng: coords?.lng ?? null,
            images: imageUrl ? [imageUrl] : [],
            status: publish ? 'published' : 'draft',
          })
          .eq('id', eventId)

        if (updateError) {
          setError(`Failed to update event: ${updateError.message}`)
          setIsSubmitting(false)
          return
        }

        // Update ticket types (edit in place, add new, delete removed if no sales)
        const validTickets = ticketTypes.filter(t => t.name.trim() && t.price > 0)

        // Load existing ticket type ids for this event
        const { data: existingRows, error: existingError } = await supabase
          .from('ticket_types')
          .select('id')
          .eq('event_id', eventId)

        if (existingError) {
          setError(`Failed to load existing ticket types: ${existingError.message}`)
          setIsSubmitting(false)
          return
        }

        const existingIds = new Set((existingRows || []).map(r => r.id))
        const keepIds = new Set(validTickets.filter(t => t.id).map(t => t.id as number))

        // Delete removed ticket types only if no sales
        const toDelete = Array.from(existingIds).filter(id => !keepIds.has(id as number))
        if (toDelete.length > 0) {
          for (const id of toDelete) {
            const ticket = ticketTypes.find(t => t.id === id)
            if (ticket?.sold && ticket.sold > 0) {
              setError(`Cannot remove ticket type "${ticket.name}" because it has sales.`)
              setIsSubmitting(false)
              return
            }

            const { count: itemCount, error: itemError } = await supabase
              .from('order_items')
              .select('id', { count: 'exact', head: true })
              .eq('ticket_type_id', id)

            if (itemError) {
              setError(`Failed to check ticket usage: ${itemError.message}`)
              setIsSubmitting(false)
              return
            }

            if ((itemCount || 0) > 0) {
              setError(`Cannot remove ticket type "${ticket?.name || 'Ticket'}" because it has orders.`)
              setIsSubmitting(false)
              return
            }
          }

          const { error: deleteError } = await supabase
            .from('ticket_types')
            .delete()
            .in('id', toDelete as number[])

          if (deleteError) {
            setError(`Failed to delete removed ticket types: ${deleteError.message}`)
            setIsSubmitting(false)
            return
          }
        }

        // Update existing and insert new
        for (const ticket of validTickets) {
          const sold = ticket.sold || 0
          if (ticket.id) {
            if (sold > 0 && ticket.quantity < sold) {
              setError(`Quantity for "${ticket.name}" cannot be less than tickets sold (${sold}).`)
              setIsSubmitting(false)
              return
            }

            const available = Math.max(0, ticket.quantity - sold)
            const { error: updateTicketError } = await supabase
              .from('ticket_types')
              .update({
                name: ticket.name,
                price: ticket.price,
                quantity: ticket.quantity,
                quantity_available: available,
              })
              .eq('id', ticket.id)

            if (updateTicketError) {
              setError(`Failed to update ticket type: ${updateTicketError.message}`)
              setIsSubmitting(false)
              return
            }
          } else {
            const { error: insertTicketError } = await supabase
              .from('ticket_types')
              .insert({
                event_id: eventId,
                name: ticket.name,
                price: ticket.price,
                quantity: ticket.quantity,
                quantity_available: ticket.quantity,
              })

            if (insertTicketError) {
              setError(`Failed to add ticket type: ${insertTicketError.message}`)
              setIsSubmitting(false)
              return
            }
          }
        }

        // TODO: Send notifications if date or venue changed and event is published
        if (originalEventData) {
          const dateChanged = 
            originalEventData.date !== formData.date || 
            originalEventData.startTime !== formData.startTime
          const venueChanged = originalEventData.location !== formData.location
          
          if ((dateChanged || venueChanged) && (originalEventData.status === 'published' || publish)) {
            try {
              await fetch('/api/notifications/send-event-change', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  eventId,
                  changes: { dateChanged, venueChanged },
                }),
              })
            } catch (err) {
              console.error('Failed to send change notifications:', err)
            }
          }
        }

        if (publish) {
          setPublishSuccess(true)
        } else {
          router.push(editReturnPath)
        }
      } else {
        // CREATE new event
        const { data: createdEvent, error: insertError } = await supabase
          .from('events')
          .insert({
            created_by: currentUserId,
            title: formData.title,
            description: formData.description,
            start_date: eventDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            sport_category: formData.sportCategory,
            venue: formData.location,
            location_url: formData.locationUrl || null,
            lat: coords?.lat ?? null,
            lng: coords?.lng ?? null,
            images: imageUrl ? [imageUrl] : [],
            status: publish ? 'published' : 'draft',
          })
          .select('id')
          .single()

        if (insertError || !createdEvent) {
          setError(`Failed to create event: ${insertError?.message || 'Unknown error'}`)
          setIsSubmitting(false)
          return
        }

        // Insert ticket types linked to event
        const validTickets = ticketTypes.filter(t => t.name.trim() && t.price > 0 && t.quantity > 0)
        const ticketRows = validTickets.map((ticket) => ({
          event_id: createdEvent.id,
          name: ticket.name,
          price: ticket.price,
          quantity: ticket.quantity,
          quantity_available: ticket.quantity,
        }))

        const { error: ticketInsertError } = await supabase
          .from('ticket_types')
          .insert(ticketRows)

        if (ticketInsertError) {
          setError(`Failed to save ticket types: ${ticketInsertError.message}`)
          setIsSubmitting(false)
          return
        }

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
          image: '',
        })
        setImageFile(null)
        setTicketTypes([{ name: 'General', price: 0, quantity: 0 }])

        // Redirect based on publish status
        if (publish) {
          setPublishSuccess(true)
        } else {
          router.push('/drafts')
        }
      }
    } catch (err) {
      setError('Failed to submit event. Please try again.')
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePublishConfirm = async () => {
    await handleSubmit({} as React.FormEvent, true)
    setShowPublishModal(false)
    setPendingPublish(false)
  }

  if (isLoading || !roleChecked) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Loading event...</div>
      </main>
    )
  }

  if (!isOrganizer) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-red-200 p-8 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-50 rounded-full">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900">Organizer or Admin Access Required</h1>
          <p className="text-slate-500 text-sm">Only organizer or admin accounts can create or edit events. If you believe this is an error, contact support.</p>
          <Link href="/events" className="inline-block rounded-lg bg-indigo-500 text-white px-6 py-2.5 font-semibold hover:bg-indigo-600 transition-colors">
            Browse Events
          </Link>
        </div>
      </main>
    )
  }

  if (isSubmitting) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">{isEditing ? 'Updating...' : 'Submitting...'}</div>
      </main>
    )
  }

  if (publishSuccess) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 p-8 text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-50 rounded-full">
            <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">{isEditing ? 'Event Updated!' : 'Event Published!'}</h1>
            <p className="text-slate-500">{isEditing ? 'Your event has been successfully updated.' : 'Your event has been successfully published and is now live.'}</p>
          </div>
          <button
            onClick={() => router.push(isEditing ? editReturnPath : '/events')}
            className="w-full rounded-lg bg-indigo-500 text-white py-3 font-semibold hover:bg-indigo-600 transition-colors"
          >
            {isEditing ? (editReturnPath.startsWith('/admin') ? 'Back to Admin Dashboard' : 'Back to My Events') : 'View All Events'}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="flex justify-between items-center mb-6">
          <Link href="/events" className="text-sm text-indigo-500 hover:text-indigo-600 transition-colors">
            ← Back to Events
          </Link>
          <div className="flex gap-4">
            <Link href={editReturnPath} className="text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors">
              {editReturnPath.startsWith('/admin') ? 'Admin Dashboard' : 'My Events'}
            </Link>
            <Link href="/drafts" className="text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors">
              Drafts
            </Link>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-xl border border-slate-200 p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            {isEditing ? 'Edit Event' : 'Submit New Event'}
          </h1>
          <p className="text-slate-500 mb-6">
            {isEditing ? 'Update your event details' : 'Create and share your event with the community'}
          </p>

          <form className="space-y-6">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-red-800">{error}</p>
              </div>
            )}

            {saveNotice && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
                <p className="text-emerald-800">{saveNotice}</p>
              </div>
            )}

            {dateWarning && (
              <div className="rounded-lg bg-orange-50 border border-orange-200 p-4">
                <p className="text-orange-800">{dateWarning}</p>
              </div>
            )}

            {venueWarning && (
              <div className="rounded-lg bg-orange-50 border border-orange-200 p-4">
                <p className="text-orange-800">{venueWarning}</p>
              </div>
            )}

            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-1">
                Event Title *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g., Community Marathon 2026"
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1">
                Description *
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe your event in detail..."
                rows={4}
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>

            {/* Date */}
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-slate-700 mb-1">
                Event Date *
              </label>
              <input
                type="date"
                id="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>

            {/* Start and End Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="startTime" className="block text-sm font-medium text-slate-700 mb-1">
                  Start Time *
                </label>
                <input
                  type="time"
                  id="startTime"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>
              <div>
                <label htmlFor="endTime" className="block text-sm font-medium text-slate-700 mb-1">
                  End Time *
                </label>
                <input
                  type="time"
                  id="endTime"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>
            </div>

            {/* Sport Category */}
            <div>
              <label htmlFor="sportCategory" className="block text-sm font-medium text-slate-700 mb-1">
                Sport Category *
              </label>
              <select
                id="sportCategory"
                name="sportCategory"
                value={formData.sportCategory}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
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
              <label htmlFor="location" className="block text-sm font-medium text-slate-700 mb-1">
                Location *
              </label>
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="e.g., Central Park, Downtown"
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>

            {/* Location URL */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="locationUrl" className="block text-sm font-medium text-slate-700">
                  Google Maps Link *
                </label>
                <button
                  type="button"
                  onClick={() => setShowLocationHelp(!showLocationHelp)}
                  className="text-xs text-indigo-500 hover:text-indigo-600 font-medium underline"
                >
                  {showLocationHelp ? 'Hide help' : 'How to get a Maps link?'}
                </button>
              </div>

              {showLocationHelp && (
                <div className="mb-3 rounded-lg bg-indigo-50 border border-indigo-200 p-4 text-sm text-slate-700 space-y-2">
                  <p className="font-semibold text-slate-900">How to get a Google Maps link with coordinates:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Open <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer" className="underline font-medium text-indigo-600">Google Maps</a> and search for your venue.</li>
                    <li>Right-click (or long-press on mobile) on the exact location pin.</li>
                    <li>Click the coordinates that appear at the top of the context menu — they will be copied to your clipboard.</li>
                    <li>Alternatively, copy the URL from your browser address bar — it contains the coordinates after the <code className="bg-indigo-100 px-1 rounded">@</code> sign.</li>
                  </ol>
                  <p className="text-slate-500">Example URL: <code className="bg-indigo-100 px-1 rounded text-xs break-all">https://www.google.com/maps/place/.../@53.3498,-6.2603,15z/...</code></p>
                  <p className="text-indigo-600 font-medium">Providing this link will place a marker for your event on the map!</p>
                </div>
              )}

              <input
                type="url"
                id="locationUrl"
                name="locationUrl"
                value={formData.locationUrl}
                onChange={handleChange}
                placeholder="https://www.google.com/maps/place/.../@53.3498,-6.2603,15z"
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />

              {/* Coordinate extraction feedback */}
              {formData.locationUrl && (
                <div className="mt-2">
                  {extractedCoords ? (
                    <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <span className="text-green-500 text-lg">✓</span>
                      <span>
                        Coordinates detected: <strong>{extractedCoords.lat.toFixed(4)}, {extractedCoords.lng.toFixed(4)}</strong>
                        — your event will appear on the map!
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <span className="text-amber-500 text-lg">⚠</span>
                      <span>
                        Could not extract coordinates from this URL. Make sure the link is a full Google Maps URL containing coordinates (e.g. with <code className="bg-amber-100 px-1 rounded">@lat,lng</code> or <code className="bg-amber-100 px-1 rounded">?q=lat,lng</code>).
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>


            {/* Image Upload */}
            <div>
              <label htmlFor="image" className="block text-sm font-medium text-slate-700 mb-1">
                Event Image (optional)
              </label>

              {/* Show current image when editing */}
              {isEditing && formData.image && !imageFile && (
                <div className="mb-3 rounded-lg border border-slate-200 p-3 bg-slate-50">
                  <p className="text-xs font-medium text-slate-500 mb-2">Current image</p>
                  <div className="flex items-start gap-3">
                    <img
                      src={formData.image}
                      alt="Current event image"
                      className="w-24 h-16 rounded object-cover border border-slate-200"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500 truncate">{formData.image}</p>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                        className="mt-1 text-xs text-red-500 hover:text-red-600 font-medium"
                      >
                        Remove image
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <input
                type="file"
                id="image"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
              {imageFile && (
                <p className="text-sm text-slate-500 mt-1">Selected: {imageFile.name}</p>
              )}
              {isEditing && !imageFile && (
                <p className="text-xs text-slate-400 mt-1">Upload a new file to replace the current image, or leave as is.</p>
              )}
            </div>

            {/* Ticket Types */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">
                  Ticket Types & Prices *
                </label>
                {isEditing && ticketTypes.some(t => t.sold && t.sold > 0) && (
                  <span className="text-xs text-slate-400">
                    Ticket types with sales cannot be removed
                  </span>
                )}
              </div>
              {ticketTypes.map((ticket, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      placeholder="Ticket name (e.g., General, Student)"
                      value={ticket.name}
                      onChange={(e) => handleTicketChange(index, 'name', e.target.value)}
                      className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      required
                    />
                    <input
                      type="number"
                      placeholder="Price"
                      min="0"
                      step="0.01"
                      value={ticket.price || ''}
                      onChange={(e) => handleTicketChange(index, 'price', e.target.value)}
                      className="w-32 rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      required
                    />
                    <input
                      type="number"
                      placeholder="Quantity"
                      min="0"
                      value={ticket.quantity || ''}
                      onChange={(e) => handleTicketChange(index, 'quantity', e.target.value)}
                      className="w-28 rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      title="Total number of tickets available"
                      required
                    />
                    {ticketTypes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTicketType(index)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!!(isEditing && ticket.sold && ticket.sold > 0)}
                        title={isEditing && ticket.sold && ticket.sold > 0 ? `Cannot remove - ${ticket.sold} tickets sold` : 'Remove ticket type'}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {isEditing && ticket.sold !== undefined && ticket.sold > 0 && (
                    <p className="text-sm text-indigo-600 ml-1">
                      {ticket.sold} ticket{ticket.sold !== 1 ? 's' : ''} sold
                    </p>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addTicketType}
                className="text-sm text-indigo-500 hover:text-indigo-600 font-medium transition-colors"
              >
                + Add Another Ticket Type
              </button>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={(e) => handleSubmit(e as React.FormEvent, false)}
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-slate-100 text-slate-700 py-3 font-semibold hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? (isEditing ? 'Saving Changes...' : 'Saving...') : (isEditing ? 'Save Changes' : 'Save as Draft')}
              </button>
              <button
                type="button"
                onClick={() => {
                  // Validate before showing modal
                  if (!validateRequiredFields()) return
                  if (!validateTicketTypes()) return
                  setPendingPublish(true)
                  setShowPublishModal(true)
                }}
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-indigo-500 text-white py-3 font-semibold hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? (isEditing ? 'Updating...' : 'Publishing...') : (isEditing ? 'Update & Publish' : 'Publish Event')}
              </button>
              <Link
                href={isEditing ? editReturnPath : '/events'}
                className="flex-1 rounded-lg border border-slate-200 text-slate-700 py-3 font-semibold text-center hover:bg-slate-50 transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>

      {showPublishModal && pendingPublish && (
        <PublishConfirmationModal
          event={{
            id: 0,
            title: formData.title,
            description: formData.description,
            start_date: `${formData.date}T${formData.startTime}`,
          }}
          onConfirm={handlePublishConfirm}
          onCancel={() => {
            setShowPublishModal(false)
            setPendingPublish(false)
          }}
        />
      )}
    </main>
  )
}
