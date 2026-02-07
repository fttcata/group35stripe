"use client"

import Image from "next/image"
import Link from "next/link"
import { useMemo, useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { events as eventsData, type Event } from "../events/data"

const MAX_PER_TYPE = 6

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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

function EventDetailsContent() {
  const searchParams = useSearchParams()
  const slug = searchParams.get("slug")
  
  const [allEvents, setAllEvents] = useState<Event[]>(eventsData)

  useEffect(() => {
    // Load submitted events from localStorage
    const submittedEvents = JSON.parse(localStorage.getItem('submittedEvents') || '[]')
    setAllEvents([...eventsData, ...submittedEvents])
  }, [])

  const event = allEvents.find((e) => e.slug === slug)

  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [paymentOption, setPaymentOption] = useState<"pay-now" | "pay-on-day">("pay-now")

  // Initialize quantities when event loads
  useEffect(() => {
    if (event && event.ticketTypes) {
      const initial: Record<string, number> = {}
      event.ticketTypes.forEach((_, index) => {
        initial[index.toString()] = 0
      })
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

	const overMax = event?.ticketTypes?.some((_, index) => (quantities[index.toString()] ?? 0) > MAX_PER_TYPE) ?? false
	const hasMinimum = totals.totalTickets >= 1
	const isValid = hasMinimum && !overMax

  const handleContinue = () => {
    if (!event || !isValid) return
    
    // Store cart data in localStorage
    localStorage.setItem('cartData', JSON.stringify({
      event: {
        id: event.slug,
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

	if (!event) {
		return (
			<main className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 px-4 py-16">
				<div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg p-8 text-center space-y-4">
					<h1 className="text-2xl font-bold text-gray-900">Event not found</h1>
					<p className="text-gray-600">We couldn’t find this event. Please return to the events list.</p>
					<Link
						href="/events"
						className="inline-flex items-center justify-center rounded-full bg-purple-600 text-white px-6 py-2 hover:bg-purple-700"
					>
						Back to Events
					</Link>
				</div>
			</main>
		)
	}

	return (
		<main className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
			<div className="max-w-6xl mx-auto px-4 py-10">
				<Link href="/events" className="text-sm text-purple-700 hover:text-purple-900">
					← Back to Events
				</Link>

				<div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8">
					<section className="bg-white rounded-2xl shadow-lg overflow-hidden">
						{event.image && (
							<div className="relative h-72 w-full">
								<Image src={event.image} alt={event.title} fill className="object-cover" unoptimized />
							</div>
						)}
						<div className="p-8 space-y-4">
							<div className="space-y-2">
								<div className="flex items-center gap-2">
									<h1 className="text-3xl font-bold text-gray-900">{event.title}</h1>
									{event.sportCategory && (
										<span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
											{event.sportCategory}
										</span>
									)}
								</div>
								<p className="text-gray-600">{event.description}</p>
							</div>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
								<div className="bg-purple-50 rounded-xl p-4">
									<div className="text-purple-700 font-semibold">Date</div>
									<div className="text-gray-800">{formatDate(event.date)}</div>
								</div>
								{event.startTime && event.endTime && (
									<div className="bg-blue-50 rounded-xl p-4">
										<div className="text-blue-700 font-semibold">Time</div>
										<div className="text-gray-800">{event.startTime} - {event.endTime}</div>
									</div>
								)}
								<div className="bg-pink-50 rounded-xl p-4">
									<div className="text-pink-700 font-semibold">Location</div>
									<div className="text-gray-800 flex items-center gap-2">
										<span>{event.location ?? "Location TBA"}</span>
										{event.locationUrl && (
											<a 
												href={event.locationUrl} 
												target="_blank" 
												rel="noopener noreferrer"
												className="text-blue-600 hover:text-blue-800"
											>
												<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
												</svg>
											</a>
										)}
									</div>
								</div>
								{event.rating !== undefined && event.rating > 0 && (
									<div className="bg-emerald-50 rounded-xl p-4">
										<div className="text-emerald-700 font-semibold">Rating</div>
										<div className="text-gray-800">{event.rating.toFixed(1)} ⭐</div>
									</div>
								)}
							</div>
						</div>
					</section>

					<section className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
						<div className="flex items-center justify-between">
							<h2 className="text-2xl font-bold text-gray-900">Select Tickets</h2>
							<span className="text-sm text-gray-500">Max {MAX_PER_TYPE} per type</span>
						</div>

						<div className="space-y-4">
							{event.ticketTypes && event.ticketTypes.map((ticket, index) => (
								<div key={index} className="flex items-center justify-between rounded-xl border border-gray-100 p-4">
									<div>
										<div className="font-semibold text-gray-900">{ticket.name}</div>
										<div className="text-sm text-gray-500">${ticket.price.toFixed(2)} each</div>
									</div>
									<div className="flex items-center gap-3">
										<button
											type="button"
											className="h-9 w-9 rounded-full border border-gray-200 text-lg hover:bg-gray-50 disabled:opacity-50"
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
											max={MAX_PER_TYPE}
											value={quantities[index.toString()] ?? 0}
											onChange={(e) => {
												const value = Math.min(MAX_PER_TYPE, Math.max(0, Number(e.target.value) || 0))
												setQuantities((q) => ({ ...q, [index.toString()]: value }))
											}}
											className="w-14 text-center border border-gray-200 rounded-lg py-1"
											aria-label={`${ticket.name} ticket quantity`}
										/>
										<button
											type="button"
											className="h-9 w-9 rounded-full border border-gray-200 text-lg hover:bg-gray-50 disabled:opacity-50"
											onClick={() =>
												setQuantities((q) => ({
													...q,
													[index.toString()]: Math.min(MAX_PER_TYPE, (q[index.toString()] ?? 0) + 1),
												}))
											}
											disabled={(quantities[index.toString()] ?? 0) >= MAX_PER_TYPE}
											aria-label={`Increase ${ticket.name} tickets`}
										>
											+
										</button>
									</div>
								</div>
							))}
						</div>

						<div className="space-y-3">
							<div className="font-semibold text-gray-900">Payment Option</div>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<label
									className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer ${
										paymentOption === "pay-now" ? "border-purple-500 bg-purple-50" : "border-gray-200"
									}`}
								>
									<input
										type="radio"
										name="payment"
										value="pay-now"
										checked={paymentOption === "pay-now"}
										onChange={() => setPaymentOption("pay-now")}
										className="accent-purple-600"
									/>
									<div>
										<div className="font-semibold">Pay Now</div>
										<div className="text-sm text-gray-500">Complete payment online</div>
									</div>
								</label>
								<label
									className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer ${
										paymentOption === "pay-on-day" ? "border-purple-500 bg-purple-50" : "border-gray-200"
									}`}
								>
									<input
										type="radio"
										name="payment"
										value="pay-on-day"
										checked={paymentOption === "pay-on-day"}
										onChange={() => setPaymentOption("pay-on-day")}
										className="accent-purple-600"
									/>
									<div>
										<div className="font-semibold">Pay on Day</div>
										<div className="text-sm text-gray-500">Pay at check-in</div>
									</div>
								</label>
							</div>
						</div>

						<div className="rounded-xl bg-gray-50 p-4 space-y-2">
							<div className="flex items-center justify-between text-sm">
								<span className="text-gray-600">Total Tickets</span>
								<span className="font-semibold text-gray-900">{totals.totalTickets}</span>
							</div>
							<div className="flex items-center justify-between text-lg">
								<span className="text-gray-700 font-semibold">Total Price</span>
								<span className="text-gray-900 font-bold">${totals.totalPrice.toFixed(2)}</span>
							</div>
						</div>

						{!hasMinimum && <p className="text-sm text-red-600">Please select at least 1 ticket.</p>}
						{overMax && (
							<p className="text-sm text-red-600">
								You can select up to {MAX_PER_TYPE} tickets per type.
							</p>
						)}

						<button
							type="button"
							onClick={handleContinue}
							className="w-full rounded-full bg-purple-600 text-white py-3 font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
							disabled={!isValid}
						>
							Continue
						</button>
					</section>
				</div>
			</div>
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
