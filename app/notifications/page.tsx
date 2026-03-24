'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  link?: string
  metadata?: Record<string, unknown>
  read: boolean
  created_at: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [respondingTo, setRespondingTo] = useState<string | null>(null)
  const [user, setUser] = useState<{ id: string } | null>(null)

  useEffect(() => {
    const init = async () => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user: u } } = await supabase.auth.getUser()
      setUser(u)
      if (u) loadNotifications()
      else setLoading(false)
    }
    init()
  }, [])

  const loadNotifications = async () => {
    try {
      const res = await fetch('/api/notifications')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setNotifications(data.notifications || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id: string) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: id }),
    })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const markAllRead = async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    })
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const respondToInvite = async (eventId: string, action: 'accept' | 'decline') => {
    setRespondingTo(eventId)
    try {
      const res = await fetch('/api/co-organizers/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Update the notification to show the action taken
      setNotifications(prev => prev.map(n => {
        if (n.type === 'co_organizer_invite' && (n.metadata as Record<string, unknown>)?.event_id === eventId) {
          return {
            ...n,
            read: true,
            message: action === 'accept'
              ? n.message.replace(/Visit your notifications.*/, `You accepted this invitation.`)
              : n.message.replace(/Visit your notifications.*/, `You declined this invitation.`),
            metadata: { ...n.metadata, responded: action },
          }
        }
        return n
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to respond')
    } finally {
      setRespondingTo(null)
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

  const getIcon = (type: string) => {
    switch (type) {
      case 'event_update':
        return (
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
          </div>
        )
      case 'co_organizer_invite':
        return (
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </div>
        )
      case 'co_organizer_accepted':
        return (
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
        )
      default:
        return (
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          </div>
        )
    }
  }

  if (!user && !loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Please sign in to view your notifications.</p>
          <Link href="/login" className="text-indigo-500 hover:text-indigo-600 font-semibold">Sign in</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-slate-500 mt-1">{unreadCount} unread</p>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-sm text-indigo-500 hover:text-indigo-600 font-medium"
            >
              Mark all as read
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-2/3" />
                    <div className="h-3 bg-slate-100 rounded w-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
            <svg className="mx-auto w-12 h-12 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            <p className="text-slate-500">No notifications yet.</p>
            <p className="text-sm text-slate-400 mt-1">You&apos;ll be notified about event changes and invitations.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => {
              const isCoOrgInvite = n.type === 'co_organizer_invite'
              const eventId = (n.metadata as Record<string, unknown>)?.event_id as string | undefined
              const alreadyResponded = (n.metadata as Record<string, unknown>)?.responded as string | undefined

              return (
                <div
                  key={n.id}
                  className={`bg-white rounded-xl border p-5 transition-colors ${
                    n.read ? 'border-slate-200' : 'border-indigo-200 bg-indigo-50/30'
                  }`}
                  onClick={() => { if (!n.read) markAsRead(n.id) }}
                >
                  <div className="flex gap-4">
                    {getIcon(n.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className={`text-sm font-semibold ${n.read ? 'text-slate-700' : 'text-slate-900'}`}>
                          {n.title}
                        </h3>
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                          {new Date(n.created_at).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <p className={`text-sm mt-1 ${n.read ? 'text-slate-500' : 'text-slate-700'}`}>
                        {n.message}
                      </p>

                      {/* Co-organizer invite actions */}
                      {isCoOrgInvite && eventId && !alreadyResponded && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); respondToInvite(eventId, 'accept') }}
                            disabled={respondingTo === eventId}
                            className="px-4 py-1.5 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 disabled:bg-slate-300 transition-colors"
                          >
                            {respondingTo === eventId ? 'Processing...' : 'Accept'}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); respondToInvite(eventId, 'decline') }}
                            disabled={respondingTo === eventId}
                            className="px-4 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 disabled:bg-slate-100 transition-colors"
                          >
                            Decline
                          </button>
                        </div>
                      )}

                      {/* Show response status */}
                      {isCoOrgInvite && alreadyResponded && (
                        <p className={`text-xs mt-2 font-medium ${alreadyResponded === 'accept' ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {alreadyResponded === 'accept' ? '✓ Accepted' : '✗ Declined'}
                        </p>
                      )}

                      {/* Link for non-invite notifications */}
                      {!isCoOrgInvite && n.link && (
                        <Link
                          href={n.link}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm text-indigo-500 hover:text-indigo-600 font-medium mt-2 inline-block"
                        >
                          View details →
                        </Link>
                      )}
                    </div>

                    {!n.read && (
                      <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-2" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
