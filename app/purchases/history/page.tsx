'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { jsPDF } from 'jspdf';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Ticket {
  id: string;
  ticket_code: string;
  ticket_type: string;
  qr_code_data: string;
  is_used: boolean;
  used_at: string | null;
}

interface EventInfo {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  venue: string | null;
  sport_category: string | null;
  images: string[];
}

interface Purchase {
  id: string;
  event_id: string | null;
  total_amount: number;
  payment_status: string;
  created_at: string;
  events: EventInfo | null;
  tickets: Ticket[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDateShort(iso: string) {
  try {
    const d = new Date(iso);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  } catch {
    return iso;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IE', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isUpcoming(dateStr: string) {
  return new Date(dateStr) >= new Date();
}

function eventSlug(event: EventInfo) {
  const base = event.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  return `${base}-${event.id}`;
}

function paymentLabel(status: string) {
  const map: Record<string, { cls: string; label: string }> = {
    completed: { cls: 'bg-green-100 text-green-700', label: 'Paid' },
    pending: { cls: 'bg-yellow-100 text-yellow-700', label: 'Pending' },
    completed_email_failed: { cls: 'bg-green-100 text-green-700', label: 'Paid' },
    refunded: { cls: 'bg-red-100 text-red-700', label: 'Refunded' },
  };
  const s = map[status] || { cls: 'bg-gray-100 text-gray-700', label: status };
  return s;
}

/* ------------------------------------------------------------------ */
/*  PDF Download                                                       */
/* ------------------------------------------------------------------ */

async function downloadTicketPDF(purchase: Purchase) {
  const doc = new jsPDF();
  const event = purchase.events;
  const title = event?.title ?? 'Event Ticket';

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Eventify — Ticket', 105, 20, { align: 'center' });

  doc.setFontSize(14);
  doc.text(title, 105, 35, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (event?.start_date) {
    doc.text(`Date: ${formatDate(event.start_date)}  |  Time: ${formatTime(event.start_date)}`, 105, 43, {
      align: 'center',
    });
  }
  if (event?.venue) {
    doc.text(`Venue: ${event.venue}`, 105, 50, { align: 'center' });
  }

  doc.setDrawColor(200);
  doc.line(20, 55, 190, 55);

  let y = 65;
  for (const ticket of purchase.tickets) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Ticket: ${ticket.ticket_type}`, 20, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Code: ${ticket.ticket_code}`, 20, y);
    y += 6;
    doc.text(`Status: ${ticket.is_used ? 'Used' : 'Valid'}`, 20, y);
    y += 8;

    if (ticket.qr_code_data?.startsWith('data:image')) {
      try {
        doc.addImage(ticket.qr_code_data, 'PNG', 20, y, 45, 45);
        y += 50;
      } catch {
        y += 5;
      }
    }

    doc.setDrawColor(230);
    doc.line(20, y, 190, y);
    y += 10;
  }

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    `Order ${purchase.id}  •  Amount: €${Number(purchase.total_amount).toFixed(2)}  •  Generated ${new Date().toLocaleString()}`,
    105,
    290,
    { align: 'center' }
  );

  doc.save(`eventify-tickets-${purchase.id.slice(0, 8)}.pdf`);
}

/* ------------------------------------------------------------------ */
/*  QR Quick‑View Modal                                                */
/* ------------------------------------------------------------------ */

function QRModal({
  ticket,
  eventTitle,
  onClose,
}: {
  ticket: Ticket;
  eventTitle: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-lg text-gray-900">{eventTitle}</h3>
            <p className="text-sm text-gray-500">{ticket.ticket_type}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="flex justify-center py-4 bg-gray-50 rounded-xl">
          <img
            src={ticket.qr_code_data}
            alt={`QR code for ${ticket.ticket_code}`}
            className="w-56 h-56"
          />
        </div>

        <div className="text-center mt-4 space-y-1">
          <p className="font-mono text-sm font-bold text-indigo-600">
            {ticket.ticket_code}
          </p>
          <p className="text-xs text-gray-400">
            {ticket.is_used ? '✓ Already used' : 'Scan at event entry'}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Purchase Event Card                                                */
/* ------------------------------------------------------------------ */

function PurchaseEventCard({
  purchase,
  isPast,
  onViewQR,
  onDownload,
}: {
  purchase: Purchase;
  isPast: boolean;
  onViewQR: (ticket: Ticket, title: string) => void;
  onDownload: (purchase: Purchase) => void;
}) {
  const event = purchase.events;
  const title = event?.title ?? 'Event';
  const image = event?.images?.[0];
  const ticketCount = purchase.tickets?.length ?? 0;
  const payment = paymentLabel(purchase.payment_status);
  const upcoming = event?.start_date ? isUpcoming(event.start_date) : false;

  const cardContent = (
    <article
      className={`group bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100 flex flex-col h-full transition-all duration-300 ${
        isPast
          ? 'opacity-75 hover:opacity-100'
          : 'hover:shadow-2xl hover:border-purple-200 hover:-translate-y-1'
      }`}
    >
      {/* Image */}
      <div className="w-full h-48 relative overflow-hidden bg-gradient-to-br from-purple-100 to-blue-100">
        {image ? (
          <Image
            src={image}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-16 h-16 text-purple-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Date badge */}
        {event?.start_date && (
          <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-full px-3 py-1 shadow-md z-10">
            <span className="text-xs font-semibold text-purple-700">{formatDateShort(event.start_date)}</span>
          </div>
        )}

        {/* Sport category badge */}
        {event?.sport_category && (
          <div className="absolute top-3 left-3 bg-blue-600/95 backdrop-blur-sm rounded-full px-3 py-1 shadow-md z-10">
            <span className="text-xs font-semibold text-white">{event.sport_category}</span>
          </div>
        )}

        {/* Purchased badge */}
        <div className="absolute bottom-3 left-3 bg-green-600/95 backdrop-blur-sm rounded-full px-3 py-1 shadow-md z-10 flex items-center gap-1">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-xs font-semibold text-white">Purchased</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-lg font-bold text-gray-900 group-hover:text-purple-700 transition-colors line-clamp-2">
              {title}
            </h3>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${payment.cls}`}>
              {payment.label}
            </span>
          </div>

          {event?.description && (
            <p className="text-sm text-gray-500 line-clamp-2">{event.description}</p>
          )}

          {/* Meta */}
          <div className="space-y-1.5 pt-1">
            {event?.start_date && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{formatDate(event.start_date)} · {formatTime(event.start_date)}</span>
              </div>
            )}
            {event?.venue && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <svg className="w-4 h-4 text-purple-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="truncate">{event.venue}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tickets section */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-700">
              🎫 {ticketCount} Ticket{ticketCount !== 1 ? 's' : ''} · €{Number(purchase.total_amount).toFixed(2)}
            </span>
          </div>

          <div className="space-y-2">
            {purchase.tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100"
              >
                <div className="min-w-0">
                  <span className="text-sm font-medium text-gray-800 block truncate">
                    {ticket.ticket_type}
                  </span>
                  <span className="text-xs font-mono text-gray-400">
                    {ticket.ticket_code}
                  </span>
                </div>
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  {ticket.is_used ? (
                    <span className="text-xs text-gray-500 bg-gray-200 rounded-full px-2.5 py-0.5 font-medium">
                      Used
                    </span>
                  ) : (
                    <span className="text-xs text-green-700 bg-green-100 rounded-full px-2.5 py-0.5 font-medium">
                      Valid
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onViewQR(ticket, title);
                    }}
                    className="inline-flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    title="View QR Code"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    QR Code
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            Ordered {formatDate(purchase.created_at)}
          </span>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDownload(purchase);
            }}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download PDF
          </button>
        </div>
      </div>
    </article>
  );

  // Wrap in link to event detail if event exists and is upcoming
  if (event && upcoming) {
    return (
      <Link
        href={`/eventDetails?slug=${encodeURIComponent(eventSlug(event))}`}
        className="block h-full"
      >
        {cardContent}
      </Link>
    );
  }

  return <div className="h-full">{cardContent}</div>;
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function PurchasesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qrModal, setQrModal] = useState<{
    ticket: Ticket;
    title: string;
  } | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (!data.user) setLoading(false);
    });
  }, []);

  const fetchPurchases = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/purchases');
      if (res.status === 401) {
        setError('Please sign in to view your purchases.');
        return;
      }
      if (!res.ok) throw new Error('Failed to load purchases');
      const data = await res.json();
      setPurchases(data.purchases ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchPurchases();
  }, [user, fetchPurchases]);

  // Sort by event date (soonest first for upcoming, most recent first for past)
  const upcoming = purchases
    .filter((p) => p.events?.start_date && isUpcoming(p.events.start_date))
    .sort((a, b) => new Date(a.events!.start_date).getTime() - new Date(b.events!.start_date).getTime());

  const past = purchases
    .filter((p) => !p.events?.start_date || !isUpcoming(p.events.start_date))
    .sort((a, b) => {
      const da = a.events?.start_date ? new Date(a.events.start_date).getTime() : 0;
      const db = b.events?.start_date ? new Date(b.events.start_date).getTime() : 0;
      return db - da;
    });

  /* ---- Not signed in ---- */
  if (!loading && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🎟️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">My Purchases</h1>
          <p className="text-gray-500 mb-6">
            Sign in to view all events you&apos;ve purchased tickets for.
          </p>
          <Link
            href="/login"
            className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl px-8 py-3 transition shadow-lg shadow-purple-200"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-700 text-white">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative max-w-6xl mx-auto px-4 py-12 sm:py-16">
          <div className="text-center space-y-3">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
              My Purchases
            </h1>
            <p className="text-lg sm:text-xl text-purple-100 max-w-2xl mx-auto">
              All your event tickets in one place
            </p>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-purple-50 to-transparent" />
      </div>

      <main className="max-w-6xl mx-auto px-4 py-10">
        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse"
              >
                <div className="h-48 bg-gray-200" />
                <div className="p-5 space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                  <div className="h-4 bg-gray-100 rounded w-2/3" />
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="h-10 bg-gray-100 rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 text-center">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && purchases.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-5">🎟️</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              No purchases yet
            </h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              Browse upcoming events and grab your first tickets!
            </p>
            <Link
              href="/events"
              className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl px-8 py-3 transition shadow-lg shadow-purple-200"
            >
              Browse Events
            </Link>
          </div>
        )}

        {/* Upcoming */}
        {!loading && upcoming.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
              </span>
              <h2 className="text-2xl font-bold text-gray-900">Upcoming Events</h2>
              <span className="text-sm font-medium text-gray-400 bg-gray-100 rounded-full px-3 py-0.5">
                {upcoming.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcoming.map((p) => (
                <PurchaseEventCard
                  key={p.id}
                  purchase={p}
                  isPast={false}
                  onViewQR={(ticket, title) => setQrModal({ ticket, title })}
                  onDownload={downloadTicketPDF}
                />
              ))}
            </div>
          </section>
        )}

        {/* Past */}
        {!loading && past.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <span className="inline-flex rounded-full h-3 w-3 bg-gray-400" />
              <h2 className="text-2xl font-bold text-gray-900">Past Events</h2>
              <span className="text-sm font-medium text-gray-400 bg-gray-100 rounded-full px-3 py-0.5">
                {past.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {past.map((p) => (
                <PurchaseEventCard
                  key={p.id}
                  purchase={p}
                  isPast={true}
                  onViewQR={(ticket, title) => setQrModal({ ticket, title })}
                  onDownload={downloadTicketPDF}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* QR modal */}
      {qrModal && (
        <QRModal
          ticket={qrModal.ticket}
          eventTitle={qrModal.title}
          onClose={() => setQrModal(null)}
        />
      )}
    </div>
  );
}
