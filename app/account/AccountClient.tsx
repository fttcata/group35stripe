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

export default function AccountClient({ email, fullName, role, memberSince }: AccountClientProps) {
	const [activationCode, setActivationCode] = useState('')
	const [claimLoading, setClaimLoading] = useState(false)
	const [claimError, setClaimError] = useState<string | null>(null)
	const [claimSuccess, setClaimSuccess] = useState<string | null>(null)
	const [staffEvents, setStaffEvents] = useState<StaffEvent[]>([])
	const [loadingStaffEvents, setLoadingStaffEvents] = useState(true)

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
	}, [])

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
		<div className="min-h-screen bg-gray-50 py-12 px-4">
			<div className="max-w-3xl mx-auto space-y-6">
				<div className="bg-white rounded-lg shadow p-6">
					<h1 className="text-2xl font-bold text-gray-900 mb-6">My Account</h1>

					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium text-gray-500">Name</label>
							<p className="mt-1 text-gray-900">{fullName || '—'}</p>
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-500">Email</label>
							<p className="mt-1 text-gray-900">{email}</p>
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-500">Role</label>
							<span className="mt-1 inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800 capitalize">
								{role}
							</span>
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-500">Member since</label>
							<p className="mt-1 text-gray-900">{memberSince}</p>
						</div>
					</div>
				</div>

				<div className="bg-white rounded-lg shadow p-6">
					<h2 className="text-xl font-bold text-gray-900">Activate Event Staff Access</h2>
					<p className="mt-2 text-sm text-gray-600">
						If an organizer invited this email to event staff, enter your code to unlock scanner permissions for that event.
					</p>

					<div className="mt-4 flex gap-2">
						<input
							value={activationCode}
							onChange={(e) => setActivationCode(e.target.value)}
							placeholder="Enter staff code"
							className="flex-1 rounded-lg border border-gray-300 px-3 py-2 font-mono uppercase"
						/>
						<button
							onClick={claimStaffCode}
							disabled={claimLoading}
							className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold px-4 py-2"
						>
							{claimLoading ? 'Activating...' : 'Activate'}
						</button>
					</div>

					{claimError && <p className="mt-3 text-sm text-red-700">{claimError}</p>}
					{claimSuccess && <p className="mt-3 text-sm text-green-700">{claimSuccess}</p>}
				</div>

				<div className="bg-white rounded-lg shadow p-6">
					<div className="flex items-center justify-between">
						<h2 className="text-xl font-bold text-gray-900">My Staff Events</h2>
						{staffEvents.length > 0 && (
							<Link href="/staff/scan" className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-3 py-2">
								Open Scanner
							</Link>
						)}
					</div>

					{loadingStaffEvents ? (
						<p className="mt-3 text-sm text-gray-500">Loading staff events...</p>
					) : staffEvents.length === 0 ? (
						<p className="mt-3 text-sm text-gray-500">No active staff assignments yet.</p>
					) : (
						<ul className="mt-3 space-y-2">
							{staffEvents.map((event) => (
								<li key={event.eventId} className="rounded-lg border border-gray-200 p-3">
									<p className="font-semibold text-gray-900">{event.title}</p>
									<p className="text-sm text-gray-600">
										{event.startDate ? new Date(event.startDate).toLocaleString() : 'Date TBA'}
										{event.venue ? ` • ${event.venue}` : ''}
									</p>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>
		</div>
	)
}
