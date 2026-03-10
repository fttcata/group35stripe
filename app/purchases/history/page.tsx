'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
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

function paymentBadge(status: string) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    completed: { bg: 'bg-green-100', text: 'text-green-800', label: 'Paid' },
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
    completed_email_failed: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      label: 'Paid',
    },
    refunded: { bg: 'bg-red-100', text: 'text-red-800', label: 'Refunded' },
  };
  const style = map[status] || {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    label: status,
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  PDF Download                                                       */
/* ------------------------------------------------------------------ */

async function downloadTicketPDF(purchase: Purchase) {
  const doc = new jsPDF();
  const event = purchase.events;
  const title = event?.title ?? 'Event Ticket';

  // Header
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Eventify — Ticket', 105, 20, { align: 'center' });

  // Event details
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

  // Tickets
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

    // Embed QR code image
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

  // Footer
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
        className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4"
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

        <div className="flex justify-center py-4">
          <img
            src={ticket.qr_code_data}
            alt={`QR code for ${ticket.ticket_code}`}
            className="w-56 h-56 border border-gray-200 rounded-lg"
          />
        </div>

        <div className="text-center mt-2">
          <p className="font-mono text-sm font-bold text-indigo-600">
            {ticket.ticket_code}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {ticket.is_used ? '✓ Already used' : 'Scan at event entry'}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Purchase Card                                                      */
/* ------------------------------------------------------------------ */

function PurchaseCard({
  purchase,
  isPast,
  onViewQR,
}: {
  purchase: Purchase;
  isPast: boolean;
  onViewQR: (ticket: Ticket, title: string) => void;
}) {
  const event = purchase.events;
  const ticketCount = purchase.tickets?.length ?? 0;
  const title = event?.title ?? 'Event';

  return (
    <div
      className={`bg-white rounded-xl border ${isPast ? 'border-gray-200 opacity-80' : 'border-gray-200 shadow-sm hover:shadow-md transition-shadow'}`}
    >
      {/* Top bar */}
      <div className="flex items-start justify-between p-5 pb-3">
        <div className="flex-1 min-w-0">
          {event ? (
            <Link
              href={`/events/${event.id}`}
              className="text-lg font-bold text-gray-900 hover:text-indigo-600 truncate block"
            >
              {title}
            </Link>
          ) : (
            <span className="text-lg font-bold text-gray-900 truncate block">
              {title}
            </span>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
            {event?.start_date && <span>📅 {formatDate(event.start_date)}</span>}
            {event?.start_date && <span>🕐 {formatTime(event.start_date)}</span>}
            {event?.venue && <span>📍 {event.venue}</span>}
            {event?.sport_category && (
              <span className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full">
                {event.sport_category}
              </span>
            )}
          </div>
        </div>

        <div className="ml-4 flex flex-col items-end gap-1">
          {paymentBadge(purchase.payment_status)}
          <span className="text-sm font-semibold text-gray-900">
            €{Number(purchase.total_amount).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Tickets */}
      <div className="px-5 pb-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-700">
            🎫 {ticketCount} Ticket{ticketCount !== 1 ? 's' : ''}
          </h4>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {purchase.tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border border-gray-100"
            >
              <div className="min-w-0">
                <span className="text-sm font-medium text-gray-800 block truncate">
                  {ticket.ticket_type}
                </span>
                <span className="text-xs font-mono text-gray-400">
                  {ticket.ticket_code}
                </span>
              </div>
              <div className="flex items-center gap-2 ml-2">
                {ticket.is_used ? (
                  <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">
                    Used
                  </span>
                ) : (
                  <span className="text-xs text-green-700 bg-green-100 rounded-full px-2 py-0.5">
                    Valid
                  </span>
                )}
                <button
                  onClick={() => onViewQR(ticket, title)}
                  className="text-indigo-600 hover:text-indigo-800 text-xs font-medium whitespace-nowrap"
                  title="View QR Code"
                >
                  QR ↗
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions bar */}
      <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between bg-gray-50/50 rounded-b-xl">
        <span className="text-xs text-gray-400">
          Ordered {formatDate(purchase.created_at)}
        </span>
        <button
          onClick={() => downloadTicketPDF(purchase)}
          className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          📄 Download PDF
        </button>
      </div>
    </div>
  );
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

  // Auth check
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

  // Fetch purchases
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

  // Split upcoming vs past (purchases without event data go to past)
  const upcoming = purchases.filter((p) => p.events?.start_date && isUpcoming(p.events.start_date));
  const past = purchases.filter((p) => !p.events?.start_date || !isUpcoming(p.events.start_date));

  /* ---- Not signed in ---- */
  if (!loading && !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">My Purchases</h1>
          <p className="text-gray-500 mb-6">
            Sign in to view all events you&apos;ve purchased tickets for.
          </p>
          <Link
            href="/login"
            className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg px-6 py-2.5 transition"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Purchases</h1>
          <p className="text-gray-500 mt-1">
            All events you&apos;ve purchased tickets for in one place.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse"
              >
                <div className="h-5 bg-gray-200 rounded w-2/3 mb-3" />
                <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
                <div className="h-4 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && purchases.length === 0 && (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">🎟️</p>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No purchases yet
            </h2>
            <p className="text-gray-500 mb-6">
              Browse events and grab your first tickets!
            </p>
            <Link
              href="/events"
              className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg px-6 py-2.5 transition"
            >
              Browse Events
            </Link>
          </div>
        )}

        {/* Upcoming events */}
        {!loading && upcoming.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-green-500">●</span> Upcoming Events
              <span className="text-sm font-normal text-gray-400">
                ({upcoming.length})
              </span>
            </h2>
            <div className="space-y-4">
              {upcoming.map((p) => (
                <PurchaseCard
                  key={p.id}
                  purchase={p}
                  isPast={false}
                  onViewQR={(ticket, title) => setQrModal({ ticket, title })}
                />
              ))}
            </div>
          </section>
        )}

        {/* Past events */}
        {!loading && past.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-gray-400">●</span> Past Events
              <span className="text-sm font-normal text-gray-400">
                ({past.length})
              </span>
            </h2>
            <div className="space-y-4">
              {past.map((p) => (
                <PurchaseCard
                  key={p.id}
                  purchase={p}
                  isPast={true}
                  onViewQR={(ticket, title) => setQrModal({ ticket, title })}
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
