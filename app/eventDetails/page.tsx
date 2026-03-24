"use client"

import Image from "next/image"
import Link from "next/link"
import { useMemo, useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { events as eventsData, type Event, type TicketType } from "../events/data"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

export const dynamic = 'force-dynamic'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function isOrganizerRole(role: unknown) {
	if (typeof role !== 'string') return false
	const normalized = role.trim().toLowerCase()
	return normalized === 'organizer' || normalized === 'organiser'
}

function formatDate(d: string) {
	try {
		const date = new Date(d)
		const weekday = DAYS[date.getDay()]
		const month = MONTHS[date.getMonth()]
		const day = date.getDate()
		const year = date.getFullYear()
		return `${weekday}, ${month} ${day}, ${year}`
	} catch {
		return d
	}
}

type TicketAvailability = {
	total: number
	sold: number
	available: number
}

function EventDetailsContent() {
  const searchParams = useSearchParams()
  const slug = searchParams.get("slug")
	const [resolvedEventId, setResolvedEventId] = useState<string | null>(null)

	const [event, setEvent] = useState<Event | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [ticketAvailability, setTicketAvailability] = useState<Record<number, TicketAvailability>>({})

	useEffect(() => {
		const loadEvent = async () => {
			if (!slug) {
				setIsLoading(false)
				return
			}

			const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
			const uuidMatch = slug.match(uuidRegex)
			const eventIdFromSlug = uuidMatch ? uuidMatch[0] : null

			const staticEvent = eventsData.find((e) => e.slug === slug)
			if (staticEvent) {
				setEvent(staticEvent)
				setResolvedEventId(eventIdFromSlug)
				setIsLoading(false)
				return
			}

			const eventId = eventIdFromSlug

			if (!eventId) {
				setIsLoading(false)
				return
			}

			const supabase = createSupabaseBrowserClient()
			const {
				data: { user },
			} = await supabase.auth.getUser()

			let organizerMode = false
			if (user?.id) {
				const { data: profile } = await supabase
					.from('profiles')
					.select('role')
					.eq('id', user.id)
					.maybeSingle()
				organizerMode = isOrganizerRole(profile?.role || user.user_metadata?.role)
			}

			const baseQuery = supabase
				.from('events')
				.select('id,title,description,start_date,end_time,sport_category,venue,location_url,images,created_by')
				.eq('id', eventId)

			const scopedQuery = organizerMode && user?.id
				? baseQuery.eq('created_by', user.id)
				: baseQuery

			const { data: dbEvent, error: dbError } = await scopedQuery.single()

			if (dbError || !dbEvent) {
				setIsLoading(false)
				return
			}

			const { data: ticketRows } = await supabase
				.from('ticket_types')
				.select('id,name,price,quantity')
				.eq('event_id', eventId)

			const tickets: TicketType[] = (ticketRows || []).map((row) => ({
				name: row.name,
				price: row.price,
			}))

			// Fetch sold count for each ticket type
			const availability: Record<number, TicketAvailability> = {}
			for (let i = 0; i < (ticketRows || []).length; i++) {
				const row = ticketRows![i]
				try {
					const { data: soldTickets } = await supabase
						.from('tickets')
						.select('id', { count: 'exact', head: false })
						.eq('ticket_type_id', row.id)
					
					const sold = soldTickets?.length || 0
					const total = row.quantity || 0
					availability[i] = {
						total,
						sold,
						available: Math.max(0, total - sold)
					}
				} catch (err) {
					// Tickets table might not exist, assume all are available
					availability[i] = {
						total: row.quantity || 0,
						sold: 0,
						available: row.quantity || 0
					}
				}
			}
			setTicketAvailability(availability)

			const startDate = new Date(dbEvent.start_date)
			const endDate = new Date(dbEvent.end_time)
			const slugBase = dbEvent.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')

			setEvent({
				slug: `${slugBase}-${dbEvent.id}`,
				title: dbEvent.title,
				description: dbEvent.description,
				date: startDate.toISOString().slice(0, 10),
				startTime: startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
				endTime: endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
				sportCategory: dbEvent.sport_category,
				image: dbEvent.images?.[0],
				images: dbEvent.images ?? [],
				location: dbEvent.venue,
				locationUrl: dbEvent.location_url || undefined,
				rating: 0,
				ticketTypes: tickets,
			})
			setResolvedEventId(dbEvent.id)

			setIsLoading(false)
		}

		loadEvent()
	}, [slug])

  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [paymentOption, setPaymentOption] = useState<"pay-now" | "pay-on-day">("pay-now")
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const eventImages = event?.images?.length ? event.images : []
  const openLightbox = (index: number) => { setLightboxIndex(index); setLightboxOpen(true) }
  const closeLightbox = () => setLightboxOpen(false)
  const prevImage = () => setLightboxIndex((i) => (i - 1 + eventImages.length) % eventImages.length)
  const nextImage = () => setLightboxIndex((i) => (i + 1) % eventImages.length)

  // Initialize quantities when event loads
  useEffect(() => {
    if (event && event.ticketTypes) {
      const initial: Record<string, number> = {}
      event.ticketTypes.forEach((_, index) => {
        initial[index.toString()] = 0
      })
			// eslint-disable-next-line react-hooks/set-state-in-effect
      setQuantities(initial)
    }
  }, [event])

	const totals = useMemo(() => {
		if (!event || !event.ticketTypes) return { totalTickets: 0, totalPrice: 0 }
		
		const totalTickets = event.ticketTypes.reduce((sum, _, index) => {
			return sum + (quantities[index.toString()] ?? 0)
		}, 0)
		
		const totalPrice = event.ticketTypes.reduce((sum, ticket, index) => {
			return sum + (quantities[index.toString()] ?? 0) * ticket.price
		}, 0)
		
		return { totalTickets, totalPrice }
	}, [quantities, event])

	const overMax = event?.ticketTypes?.some((_, index) => {
		const available = ticketAvailability[index]?.available ?? 0
		const selected = quantities[index.toString()] ?? 0
		return selected > available
	}) ?? false
	const hasMinimum = totals.totalTickets >= 1
	const isValid = hasMinimum && !overMax

  const handleContinue = () => {
    if (!event || !isValid) return
    
    // Store cart data in localStorage
    localStorage.setItem('cartData', JSON.stringify({
      event: {
				id: resolvedEventId || event.slug,
        title: event.title,
        date: event.date,
      },
      quantities,
      paymentOption,
      totalPrice: totals.totalPrice,
      totalTickets: totals.totalTickets,
    }))
    
    // Redirect to checkout
    window.location.href = '/buy'
  }

	if (!event && !isLoading) {
		return (
			<main className="min-h-screen bg-slate-50 px-4 py-16">
				<div className="max-w-3xl mx-auto bg-white rounded-xl border border-slate-200 p-8 text-center space-y-4">
					<h1 className="text-2xl font-bold text-slate-900">Event not found</h1>
					<p className="text-slate-500">We couldn&apos;t find this event. Please return to the events list.</p>
					<Link
						href="/events"
						className="inline-flex items-center justify-center rounded-lg bg-indigo-500 text-white px-6 py-2 hover:bg-indigo-600 transition-colors"
					>
						Back to Events
					</Link>
				</div>
			</main>
		)
	}

	if (!event) {
		return (
			<main className="min-h-screen bg-slate-50 px-4 py-16">
				<div className="max-w-3xl mx-auto bg-white rounded-xl border border-slate-200 p-8 text-center space-y-4">
					<h1 className="text-2xl font-bold text-slate-900">Loading event...</h1>
				</div>
			</main>
		)
	}

	return (
		<main className="min-h-screen bg-slate-50">
			<div className="max-w-6xl mx-auto px-4 py-10">
				<Link href="/events" className="text-sm text-indigo-500 hover:text-indigo-600">
					← Back to Events
				</Link>

				<div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8">
					<section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
						{eventImages.length > 0 ? (
							<div className="space-y-2 p-2">
								{/* Hero image */}
								<button type="button" onClick={() => openLightbox(0)} className="relative w-full h-72 rounded-lg overflow-hidden cursor-pointer group">
									<Image src={eventImages[0]} alt={event.title} fill className="object-cover group-hover:scale-105 transition-transform duration-200" unoptimized />
									{eventImages.length > 1 && (
										<span className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-3 py-1.5 rounded-lg font-medium backdrop-blur-sm">
											+{eventImages.length - 1} more
										</span>
									)}
								</button>
								{/* Thumbnail strip */}
								{eventImages.length > 1 && (
									<div className="flex gap-2 overflow-x-auto pb-1">
										{eventImages.slice(1, 5).map((img, i) => (
											<button key={i} type="button" onClick={() => openLightbox(i + 1)} className="relative flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden cursor-pointer group">
												<Image src={img} alt={`${event.title} photo ${i + 2}`} fill className="object-cover group-hover:scale-105 transition-transform duration-200" unoptimized />
												{i === 3 && eventImages.length > 5 && (
													<span className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-sm font-semibold">+{eventImages.length - 5}</span>
												)}
											</button>
										))}
									</div>
								)}
							</div>
						) : (
							<div className="h-48 flex items-center justify-center bg-slate-100 text-slate-400 text-sm">
								<svg className="w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
								No images available
							</div>
						)}
						<div className="p-8 space-y-4">
							<div className="space-y-2">
								<div className="flex items-center gap-2">
									<h1 className="text-3xl font-bold text-slate-900">{event.title}</h1>
									{event.sportCategory && (
										<span className="bg-indigo-500 text-white px-3 py-1 rounded-lg text-sm font-semibold">
											{event.sportCategory}
										</span>
									)}
								</div>
								<p className="text-slate-500">{event.description}</p>
							</div>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
								<div className="bg-indigo-50 rounded-lg p-4">
									<div className="text-indigo-700 font-semibold">Date</div>
									<div className="text-slate-700">{formatDate(event.date)}</div>
								</div>
								{event.startTime && event.endTime && (
									<div className="bg-indigo-50 rounded-lg p-4">
										<div className="text-indigo-700 font-semibold">Time</div>
										<div className="text-slate-700">{event.startTime} - {event.endTime}</div>
									</div>
								)}
								<div className="bg-slate-50 rounded-lg p-4">
									<div className="text-slate-700 font-semibold">Location</div>
									<div className="text-slate-600 flex items-center gap-2">
										<span>{event.location ?? "Location TBA"}</span>
										{event.locationUrl && (
											<a 
												href={event.locationUrl} 
												target="_blank" 
												rel="noopener noreferrer"
												className="text-indigo-500 hover:text-indigo-600"
											>
												<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
												</svg>
											</a>
										)}
									</div>
								</div>
								{event.rating !== undefined && event.rating > 0 && (
									<div className="bg-emerald-50 rounded-lg p-4">
										<div className="text-emerald-700 font-semibold">Rating</div>
										<div className="text-slate-700">{event.rating.toFixed(1)} ⭐</div>
									</div>
								)}
							</div>
						</div>
					</section>

					<section className="bg-white rounded-xl border border-slate-200 p-8 space-y-6">
						<div className="flex items-center justify-between">
							<h2 className="text-2xl font-bold text-slate-900">Select Tickets</h2>
						</div>

						<div className="space-y-4">
							{event.ticketTypes && event.ticketTypes.map((ticket, index) => {
								const availability = ticketAvailability[index] || { available: 0, total: 0, sold: 0 }
								const currentQuantity = quantities[index.toString()] ?? 0
								const canIncrement = currentQuantity < availability.available
								const isOutOfStock = availability.available === 0

								return (
									<div key={index} className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
										<div>
											<div className="font-semibold text-slate-900">{ticket.name}</div>
											<div className="text-sm text-slate-500">€{ticket.price.toFixed(2)} each</div>
											<div className={`text-xs font-semibold mt-1 ${
												isOutOfStock ? 'text-red-600' : 'text-green-600'
											}`}>
												{isOutOfStock ? '❌ Sold Out' : `✓ ${availability.available} available`}
											</div>
										</div>
										<div className="flex items-center gap-3">
											<button
												type="button"
												className="h-9 w-9 rounded-lg border border-slate-200 text-lg hover:bg-slate-50 disabled:opacity-50"
												onClick={() =>
													setQuantities((q) => ({
														...q,
														[index.toString()]: Math.max(0, (q[index.toString()] ?? 0) - 1),
													}))
												}
												disabled={(quantities[index.toString()] ?? 0) <= 0}
												aria-label={`Decrease ${ticket.name} tickets`}
											>
												−
											</button>
											<input
												type="number"
												min={0}
												max={availability.available}
												value={quantities[index.toString()] ?? 0}
												onChange={(e) => {
													const value = Math.min(availability.available, Math.max(0, Number(e.target.value) || 0))
													setQuantities((q) => ({ ...q, [index.toString()]: value }))
												}}
												className="w-14 text-center border border-slate-200 rounded-lg py-1"
												aria-label={`${ticket.name} ticket quantity`}
											/>
											<button
												type="button"
												className="h-9 w-9 rounded-lg border border-slate-200 text-lg hover:bg-slate-50 disabled:opacity-50"
												onClick={() =>
													setQuantities((q) => ({
														...q,
														[index.toString()]: Math.min(availability.available, (q[index.toString()] ?? 0) + 1),
													}))
												}
												disabled={!canIncrement}
												aria-label={`Increase ${ticket.name} tickets`}
											>
												+
											</button>
										</div>
									</div>
								)
							})}
						</div>

						<div className="space-y-3">
							<div className="font-semibold text-slate-900">Payment Option</div>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<label
									className={`flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
										paymentOption === "pay-now" ? "border-indigo-500 bg-indigo-50" : "border-slate-200"
									}`}
								>
									<input
										type="radio"
										name="payment"
										value="pay-now"
										checked={paymentOption === "pay-now"}
										onChange={() => setPaymentOption("pay-now")}
										className="accent-indigo-500"
									/>
									<div>
										<div className="font-semibold">Pay Now</div>
										<div className="text-sm text-slate-500">Complete payment online</div>
									</div>
								</label>
								<label
									className={`flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
										paymentOption === "pay-on-day" ? "border-indigo-500 bg-indigo-50" : "border-slate-200"
									}`}
								>
									<input
										type="radio"
										name="payment"
										value="pay-on-day"
										checked={paymentOption === "pay-on-day"}
										onChange={() => setPaymentOption("pay-on-day")}
										className="accent-indigo-500"
									/>
									<div>
										<div className="font-semibold">Pay on Day</div>
										<div className="text-sm text-slate-500">Pay at check-in</div>
									</div>
								</label>
							</div>
						</div>

						<div className="rounded-lg bg-slate-50 p-4 space-y-2">
							<div className="flex items-center justify-between text-sm">
								<span className="text-slate-500">Total Tickets</span>
								<span className="font-semibold text-slate-900">{totals.totalTickets}</span>
							</div>
							<div className="flex items-center justify-between text-lg">
								<span className="text-slate-700 font-semibold">Total Price</span>
								<span className="text-indigo-600 font-bold">€{totals.totalPrice.toFixed(2)}</span>
							</div>
						</div>

						{!hasMinimum && <p className="text-sm text-red-600">Please select at least 1 ticket.</p>}
						{overMax && (
							<p className="text-sm text-red-600">
								You&apos;ve exceeded the available tickets for one or more types.
							</p>
						)}

						<button
							type="button"
							onClick={handleContinue}
							className="w-full rounded-lg bg-indigo-500 text-white py-3 font-semibold hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
							disabled={!isValid}
						>
							Continue
						</button>
					</section>
				</div>
			</div>

			{/* Lightbox modal */}
			{lightboxOpen && eventImages.length > 0 && (
				<div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={closeLightbox}>
					<button type="button" onClick={closeLightbox} className="absolute top-4 right-4 text-white/80 hover:text-white z-10" aria-label="Close gallery">
						<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
					</button>
					{eventImages.length > 1 && (
						<>
							<button type="button" onClick={(e) => { e.stopPropagation(); prevImage() }} className="absolute left-4 text-white/80 hover:text-white z-10" aria-label="Previous image">
								<svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
							</button>
							<button type="button" onClick={(e) => { e.stopPropagation(); nextImage() }} className="absolute right-4 text-white/80 hover:text-white z-10" aria-label="Next image">
								<svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
							</button>
						</>
					)}
					<div className="relative w-full max-w-4xl h-[80vh] mx-4" onClick={(e) => e.stopPropagation()}>
						<Image src={eventImages[lightboxIndex]} alt={`${event.title} photo ${lightboxIndex + 1}`} fill className="object-contain" unoptimized />
					</div>
					<div className="absolute bottom-4 text-white/70 text-sm font-medium">
						{lightboxIndex + 1} / {eventImages.length}
					</div>
				</div>
			)}
		</main>
	)
}

export default function EventDetailsPage() {
	return (
		<Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
			<EventDetailsContent />
		</Suspense>
	)
}
