'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/preserve-manual-memoization */

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts'
import { deleteEvent, deleteAccount } from './actions'

type Profile = any
type EventType = any
type Order = any

interface Props {
  profiles: Profile[]
  events: EventType[]
  orders: Order[]
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function AdminDashboardClient({ profiles = [], events = [], orders = [] }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const initialTab = (searchParams.get('tab') as 'overview' | 'events' | 'organizers' | 'attendees') || 'overview'
  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'organizers' | 'attendees'>(initialTab)

  // Sync state if URL changes or we want to clean up URL
  useEffect(() => {
    const tab = searchParams.get('tab') as 'overview' | 'events' | 'organizers' | 'attendees'
    if (tab && ['overview', 'events', 'organizers', 'attendees'].includes(tab)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab(tab)
    }
  }, [searchParams])

  const handleTabChange = (tab: 'overview' | 'events' | 'organizers' | 'attendees') => {
    setActiveTab(tab)
    router.replace(`/admin?tab=${tab}`, { scroll: false })
  }

  const organizers = profiles.filter((p) => p.role === 'organizer') || []
  const attendees = profiles.filter((p) => p.role === 'attendee') || []

  // Derived Stats
  const validEvents = events || []
  const publishedEvents = validEvents.filter(e => e.status === 'published').length
  const draftEvents = validEvents.filter(e => e.status === 'draft').length
  
  const totalRevenue = orders.reduce((sum, o) => {
    if (o.payment_status === 'paid' || o.payment_status === 'succeeded' || o.payment_status === 'complete') {
      return sum + Number(o.total_amount || 0)
    }
    return sum
  }, 0)

  // Monthly Chart Data Generation for Events
  const eventsTimeline = useMemo(() => {
    const counts: Record<string, number> = {}
    validEvents.forEach(e => {
      if (!e.created_at) return
      const date = new Date(e.created_at)
      const monthYear = date.toLocaleString('default', { month: 'short', year: 'numeric' })
      counts[monthYear] = (counts[monthYear] || 0) + 1
    })

    return Object.entries(counts)
      .map(([date, count]) => ({ date, eventsCreated: count }))
      .reverse() // Basic assumption for simple ordering, actually better to sort by actual date
  }, [validEvents])

  // Signups over time
  const usersTimeline = useMemo(() => {
    const counts: Record<string, { organizers: number, attendees: number }> = {}
    profiles.forEach(p => {
      if (!p.created_at) return
      const date = new Date(p.created_at)
      const monthYear = date.toLocaleString('default', { month: 'short', year: 'numeric' })
      if (!counts[monthYear]) counts[monthYear] = { organizers: 0, attendees: 0 }
      
      if (p.role === 'organizer') {
        counts[monthYear].organizers += 1
      } else {
        counts[monthYear].attendees += 1
      }
    })

    return Object.entries(counts)
      .map(([date, data]) => ({ date, ...data }))
  }, [profiles])

  // Ticket Sales (Orders) over time
  const revenueTimeline = useMemo(() => {
    const counts: Record<string, number> = {}
    orders.forEach(o => {
      if (!o.created_at) return
      const status = o.payment_status?.toLowerCase()
      if (status !== 'paid' && status !== 'complete' && status !== 'succeeded') return
      
      const date = new Date(o.created_at)
      const monthYear = date.toLocaleString('default', { month: 'short', year: 'numeric' })
      counts[monthYear] = (counts[monthYear] || 0) + Number(o.total_amount || 0)
    })

    return Object.entries(counts).map(([date, revenue]) => ({ date, revenue }))
  }, [orders])


  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="mt-2 text-gray-600">Platform-wide overview and management.</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => handleTabChange('overview')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'overview' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            Overview
          </button>
          <button
            onClick={() => handleTabChange('events')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'events' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            Events ({validEvents.length})
          </button>
          <button
            onClick={() => handleTabChange('organizers')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'organizers' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            Organizers ({organizers.length})
          </button>
          <button
            onClick={() => handleTabChange('attendees')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'attendees' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            Attendees ({attendees.length})
          </button>
        </nav>
      </div>

      {/* TAB CONTENT: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Sales Vol.</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <p className="text-4xl font-bold text-gray-900">${totalRevenue.toFixed(2)}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Events</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <p className="text-4xl font-bold text-gray-900">{validEvents.length}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-col text-sm text-gray-500">
                <span className="text-green-600 font-medium">{publishedEvents} published</span>
                <span className="text-yellow-600 font-medium">{draftEvents} drafts</span>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Organizers</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <p className="text-4xl font-bold text-gray-900">{organizers.length}</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-gray-500">{organizers.filter(o => o.stripe_account_id).length} connected Stripe</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Attendees</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <p className="text-4xl font-bold text-gray-900">{attendees.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Events Over Time */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-6">Historical Event Listings</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={eventsTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="date" tick={{fontSize: 12, fill: '#6B7280'}} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{fontSize: 12, fill: '#6B7280'}} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Area type="monotone" dataKey="eventsCreated" name="Events Published" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorEvents)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* User Acquisitions Over Time */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-6">User Acquisition Tracker</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={usersTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="date" tick={{fontSize: 12, fill: '#6B7280'}} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{fontSize: 12, fill: '#6B7280'}} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: '#F3F4F6'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="attendees" name="Attendees" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                    <Bar dataKey="organizers" name="Organizers" stackId="a" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: Events */}
      {activeTab === 'events' && (
        <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">Platform Events</h2>
          </div>
          {validEvents.length > 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Event Detail</th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {validEvents.map((event) => (
                      <tr key={event.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900">{event.title}</span>
                            <span className="text-xs text-gray-500">{event.venue || 'No venue'} &bull; {event.sport_category || 'General'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(event.start_date || event.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            event.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {event.status || 'Draft'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                          {event.status === 'published' && (
                            <Link href={`/events/${event.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}-${event.id}`} className="text-indigo-600 hover:text-indigo-900">
                              View
                            </Link>
                          )}
                          <Link href={`/submit-event?id=${event.id}`} className="text-amber-600 hover:text-amber-900">
                            Edit
                          </Link>
                          <form 
                            action={async () => {
                              if (confirm('Delete this event?')) {
                                await deleteEvent(event.id);
                              }
                            }} 
                            className="inline-block m-0 p-0"
                          >
                            <button type="submit" className="text-red-600 hover:text-red-900 font-medium">
                              Drop
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
             <div className="bg-gray-50 border border-gray-200 border-dashed rounded-xl p-12 text-center text-gray-500">No events found.</div>
          )}
        </section>
      )}

      {/* TAB CONTENT: Organizers */}
      {activeTab === 'organizers' && (
        <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">Event Organizers</h2>
          </div>
          {organizers.length > 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-indigo-50">
                    <tr>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-indigo-900 uppercase tracking-wider">Identity</th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-indigo-900 uppercase tracking-wider">Stripe Status</th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-indigo-900 uppercase tracking-wider">Joined Date</th>
                      <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-indigo-900 uppercase tracking-wider">Manage</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {organizers.map((org) => (
                      <tr key={org.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-gray-900">{org.full_name || 'No Name'}</span>
                            <span className="text-xs text-gray-500">{org.email}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {org.stripe_account_id ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Connected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span> Pending
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {org.created_at ? new Date(org.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric'}) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link href={`/admin/edit-account/${org.id}`} className="inline-flex py-1 px-3 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">
                            Edit
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 border-dashed rounded-xl p-12 text-center text-gray-500">No organizers found.</div>
          )}
        </section>
      )}

      {/* TAB CONTENT: Attendees */}
      {activeTab === 'attendees' && (
        <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">Registered Attendees</h2>
          </div>
          {attendees.length > 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-purple-50">
                    <tr>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-purple-900 uppercase tracking-wider">Identity</th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-purple-900 uppercase tracking-wider">Joined Date</th>
                      <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-purple-900 uppercase tracking-wider">Manage</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {attendees.map((att) => (
                      <tr key={att.id} className="hover:bg-purple-50/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-gray-900">{att.full_name || 'No Name'}</span>
                            <span className="text-xs text-gray-500">{att.email}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {att.created_at ? new Date(att.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric'}) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link href={`/admin/edit-account/${att.id}`} className="inline-flex py-1 px-3 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors">
                            Edit
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 border-dashed rounded-xl p-12 text-center text-gray-500">No attendees found.</div>
          )}
        </section>
      )}
    </div>
  )
}
