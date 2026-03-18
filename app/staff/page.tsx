'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type StaffEvent = {
  eventId: string;
  title: string;
  startDate: string | null;
  venue: string | null;
};

function formatDate(dateValue: string | null) {
  if (!dateValue) return 'Date TBA';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'Date TBA';
  return date.toLocaleString();
}

export default function StaffPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<StaffEvent[]>([]);

  useEffect(() => {
    const loadEvents = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/staff/my-events');
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load staff events');
        }
        setEvents(Array.isArray(data.events) ? data.events : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load staff events');
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, []);

  const sortedEvents = useMemo(
    () =>
      [...events].sort((a, b) => {
        const aTime = a.startDate ? new Date(a.startDate).getTime() : Number.POSITIVE_INFINITY;
        const bTime = b.startDate ? new Date(b.startDate).getTime() : Number.POSITIVE_INFINITY;
        return aTime - bTime;
      }),
    [events]
  );

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <section className="border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Staff Workspace</p>
          <h1 className="text-4xl font-bold tracking-tight mt-2">Select Event to Scan</h1>
          <p className="text-slate-600 mt-2 max-w-2xl">
            Choose the event you are currently working at. Ticket scanning and check-in will be locked to that selected event.
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        {loading && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">Loading staff events...</div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div>
        )}

        {!loading && !error && sortedEvents.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <p className="text-slate-700 font-semibold">No staff events available.</p>
            <p className="text-sm text-slate-600 mt-1">
              Ask an organizer to assign you as staff or activate your invite code in your account.
            </p>
            <div className="mt-4">
              <Link href="/account" className="inline-block rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2">
                Open Account
              </Link>
            </div>
          </div>
        )}

        {!loading && !error && sortedEvents.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedEvents.map((event) => (
              <Link
                key={event.eventId}
                href={`/staff/scan?eventId=${encodeURIComponent(event.eventId)}`}
                className="rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:bg-slate-50 transition-colors"
              >
                <p className="text-lg font-semibold text-slate-900">{event.title}</p>
                <p className="text-sm text-slate-600 mt-1">{formatDate(event.startDate)}</p>
                <p className="text-sm text-slate-600">{event.venue || 'Venue TBA'}</p>
                <p className="mt-4 text-sm font-semibold text-slate-900">Open Event Ticket Scanner</p>
              </Link>
            ))}
          </div>
        )}

        <div className="pt-2">
          <Link href="/organizer" className="text-sm font-semibold text-slate-700 hover:text-slate-900">
            Back to workspace
          </Link>
        </div>
      </section>
    </main>
  );
}
