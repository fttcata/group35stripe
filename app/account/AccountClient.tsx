'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface AccountClientProps {
	email: string
	fullName: string
	role: string
	memberSince: string
}

interface StaffEvent {
	eventId: string
	title: string
	startDate?: string
	venue?: string
}

interface TicketItem {
	id: string
	ticket_code: string
	ticket_type: string
	qr_code_data: string
	is_used: boolean
}

interface PurchaseEvent {
	id: string
	title: string
	date: string
	venue: string | null
	sport_category: string | null
	images: string[]
}

interface Purchase {
	id: string
	total_amount: number
	created_at: string
	events: PurchaseEvent | null
	tickets: TicketItem[]
}

export default function AccountClient({ email, fullName, role, memberSince }: AccountClientProps) {
	const [activationCode, setActivationCode] = useState('')
	const [claimLoading, setClaimLoading] = useState(false)
	const [claimError, setClaimError] = useState<string | null>(null)
	const [claimSuccess, setClaimSuccess] = useState<string | null>(null)
	const [staffEvents, setStaffEvents] = useState<StaffEvent[]>([])
	const [loadingStaffEvents, setLoadingStaffEvents] = useState(true)

	// Tickets state
	const [purchases, setPurchases] = useState<Purchase[]>([])
	const [loadingTickets, setLoadingTickets] = useState(true)
	const [qrTicket, setQrTicket] = useState<{ ticket: TicketItem; eventTitle: string } | null>(null)

	const loadStaffEvents = async () => {
		setLoadingStaffEvents(true)
		try {
			const res = await fetch('/api/staff/my-events')
			const data = await res.json()
			if (!res.ok) {
				throw new Error(data.error || 'Failed to load staff events')
			}
			setStaffEvents(data.events || [])
		} catch {
			setStaffEvents([])
		} finally {
			setLoadingStaffEvents(false)
		}
	}

	useEffect(() => {
		loadStaffEvents()
		loadTickets()
	}, [])

	const loadTickets = async () => {
		setLoadingTickets(true)
		try {
			const res = await fetch('/api/purchases')
			const data = await res.json()
			if (res.ok) {
				setPurchases(data.purchases || [])
			}
		} catch {
			setPurchases([])
		} finally {
			setLoadingTickets(false)
		}
	}

	const claimStaffCode = async () => {
		const code = activationCode.trim().toUpperCase()
		if (!code) {
			setClaimError('Enter a code first.')
			return
		}

		setClaimLoading(true)
		setClaimError(null)
		setClaimSuccess(null)

		try {
			const res = await fetch('/api/staff/claim', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code }),
			})
			const data = await res.json()
			if (!res.ok) {
				throw new Error(data.error || 'Failed to claim code')
			}

			setClaimSuccess(`Staff access activated for ${data.eventTitle || 'the event'}.`)
			setActivationCode('')
			await loadStaffEvents()
		} catch (err) {
			setClaimError(err instanceof Error ? err.message : 'Failed to claim code')
		} finally {
			setClaimLoading(false)
		}
	}

	return (
		<div className="min-h-screen bg-slate-50 py-12 px-4">
			<div className="max-w-3xl mx-auto space-y-6">
				<div className="bg-white rounded-xl border border-slate-200 p-6">
					<h1 className="text-2xl font-bold text-slate-900 mb-6">My Account</h1>

					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium text-slate-400">Name</label>
							<p className="mt-1 text-slate-900">{fullName || '—'}</p>
						</div>

						<div>
							<label className="block text-sm font-medium text-slate-400">Email</label>
							<p className="mt-1 text-slate-900">{email}</p>
						</div>

						<div>
							<label className="block text-sm font-medium text-slate-400">Role</label>
							<span className="mt-1 inline-flex items-center rounded-lg bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 capitalize">
								{role}
							</span>
						</div>

						<div>
							<label className="block text-sm font-medium text-slate-400">Member since</label>
							<p className="mt-1 text-slate-900">{memberSince}</p>
						</div>
					</div>
				</div>

				<div className="bg-white rounded-xl border border-slate-200 p-6">
					<h2 className="text-lg font-bold text-slate-900">Activate Event Staff Access</h2>
					<p className="mt-2 text-sm text-slate-500">
						If an organizer invited this email to event staff, enter your code to unlock scanner permissions for that event.
					</p>

					<div className="mt-4 flex gap-2">
						<input
							value={activationCode}
							onChange={(e) => setActivationCode(e.target.value)}
							placeholder="Enter staff code"
							className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-mono uppercase focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
						/>
						<button
							onClick={claimStaffCode}
							disabled={claimLoading}
							className="rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-300 text-white font-semibold px-4 py-2.5 text-sm transition-colors"
						>
							{claimLoading ? 'Activating...' : 'Activate'}
						</button>
					</div>

					{claimError && <p className="mt-3 text-sm text-red-700">{claimError}</p>}
					{claimSuccess && <p className="mt-3 text-sm text-green-700">{claimSuccess}</p>}
				</div>

				<div className="bg-white rounded-xl border border-slate-200 p-6">
					<div className="flex items-center justify-between">
						<h2 className="text-lg font-bold text-slate-900">My Staff Events</h2>
						{staffEvents.length > 0 && (
							<Link href="/staff" className="rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-3 py-2 transition-colors">
								Open Scanner
							</Link>
						)}
					</div>

					{loadingStaffEvents ? (
						<p className="mt-3 text-sm text-slate-400">Loading staff events...</p>
					) : staffEvents.length === 0 ? (
						<p className="mt-3 text-sm text-slate-400">No active staff assignments yet.</p>
					) : (
						<ul className="mt-3 space-y-2">
							{staffEvents.map((event) => (
								<li key={event.eventId} className="rounded-lg border border-slate-200 p-3">
									<p className="font-semibold text-slate-900">{event.title}</p>
									<p className="text-sm text-slate-500">
										{event.startDate ? new Date(event.startDate).toLocaleString() : 'Date TBA'}
										{event.venue ? ` • ${event.venue}` : ''}
									</p>
								</li>
							))}
						</ul>
					)}
				</div>

				{/* My Tickets */}
				<div className="bg-white rounded-xl border border-slate-200 p-6">
					<div className="flex items-center justify-between">
						<h2 className="text-lg font-bold text-slate-900">My Tickets</h2>
						{purchases.length > 0 && (
							<Link href="/purchases/history" className="text-indigo-500 hover:text-indigo-600 text-sm font-semibold">
								View Full History →
							</Link>
						)}
					</div>

					{loadingTickets ? (
						<p className="mt-3 text-sm text-slate-400">Loading tickets...</p>
					) : purchases.length === 0 ? (
						<p className="mt-3 text-sm text-slate-400">No tickets purchased yet.</p>
					) : (
						<div className="mt-4 space-y-3">
							{purchases.map((purchase) => {
								const event = purchase.events
								if (!event) return null
								const upcoming = new Date(event.date) >= new Date()
								return (
									<div key={purchase.id} className="rounded-lg border border-slate-200 overflow-hidden">
										<div className="flex gap-4 p-4">
											{event.images?.[0] && (
												<img
													src={event.images[0]}
													alt={event.title}
													className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
												/>
											)}
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2 mb-1">
													<h3 className="font-semibold text-slate-900 truncate">{event.title}</h3>
													{upcoming ? (
														<span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium whitespace-nowrap">Upcoming</span>
													) : (
														<span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium whitespace-nowrap">Past</span>
													)}
												</div>
												<p className="text-sm text-slate-500">
													{new Date(event.date).toLocaleDateString('en-IE', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
													{event.venue ? ` • ${event.venue}` : ''}
												</p>
												<p className="text-sm text-slate-400 mt-1">
													{purchase.tickets.length} ticket{purchase.tickets.length !== 1 ? 's' : ''} • €{Number(purchase.total_amount).toFixed(2)}
												</p>
											</div>
										</div>
										{/* Individual tickets */}
										<div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
											<div className="flex flex-wrap gap-2">
												{purchase.tickets.map((ticket) => (
													<button
														key={ticket.id}
														onClick={() => setQrTicket({ ticket, eventTitle: event.title })}
														className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
															ticket.is_used
																? 'bg-slate-100 border-slate-200 text-slate-400'
																: 'bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50'
														}`}
													>
														<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
															<path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
															<path strokeLinecap="round" strokeLinejoin="round" d="M13.5 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z" />
														</svg>
														{ticket.ticket_type}
														{ticket.is_used && <span className="text-xs">(Used)</span>}
													</button>
												))}
											</div>
										</div>
									</div>
								)
							})}
						</div>
					)}
				</div>
			</div>

			{/* QR Code Modal */}
			{qrTicket && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
					onClick={() => setQrTicket(null)}
				>
					<div
						className="bg-white rounded-xl border border-slate-200 p-6 max-w-sm w-full mx-4"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex justify-between items-start mb-4">
							<div>
								<h3 className="font-bold text-lg text-slate-900">{qrTicket.eventTitle}</h3>
								<p className="text-sm text-slate-500">{qrTicket.ticket.ticket_type}</p>
							</div>
							<button
								onClick={() => setQrTicket(null)}
								className="text-slate-400 hover:text-slate-600 text-xl leading-none"
							>
								✕
							</button>
						</div>
						<div className="flex justify-center mb-4">
							{qrTicket.ticket.qr_code_data ? (
								<img
									src={qrTicket.ticket.qr_code_data}
									alt="QR Code"
									className="w-56 h-56 rounded-lg"
								/>
							) : (
								<div className="w-56 h-56 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 text-sm">
									No QR code
								</div>
							)}
						</div>
						<div className="text-center">
							<p className="text-xs font-mono text-slate-400">{qrTicket.ticket.ticket_code}</p>
							{qrTicket.ticket.is_used && (
								<p className="mt-1 text-sm text-amber-600 font-medium">Already used</p>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
