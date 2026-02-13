'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';

interface TicketInfo {
  ticket_code: string;
  ticket_type: string;
  qr_code_data: string;
}

export default function MyTicketsPage() {
  const [email, setEmail] = useState('');
  const [orderId, setOrderId] = useState('');
  const [tickets, setTickets] = useState<TicketInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [eventInfo, setEventInfo] = useState<any>(null);

  const handleRetrieveTickets = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setTickets([]);

    try {
      if (!email && !orderId) {
        setError('Please provide an email address or order ID');
        return;
      }

      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, orderId }),
      });

      if (!response.ok) {
        throw new Error('Failed to retrieve tickets');
      }

      const data = await response.json();
      setTickets(data.tickets || []);
      setEventInfo(data.event || null);

      if (!data.tickets || data.tickets.length === 0) {
        setError('No tickets found for the provided information');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve tickets');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 antialiased">
      <main className="max-w-2xl mx-auto px-4 py-16">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold mb-2">🎫 My Tickets</h1>
          <p className="text-gray-600 mb-8">
            Retrieve your event tickets by email address or order ID
          </p>

          <form onSubmit={handleRetrieveTickets} className="space-y-4 mb-8">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1">
                <span className="text-sm text-gray-500">OR</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Order ID
              </label>
              <input
                type="text"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="Enter your order ID"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition"
            >
              {loading ? 'Retrieving...' : 'Retrieve Tickets'}
            </button>
          </form>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
              {error}
            </div>
          )}

          {tickets.length > 0 && (
            <div>
              {eventInfo && (
                <div className="bg-gray-50 p-6 rounded-lg mb-6">
                  <h2 className="text-xl font-bold mb-4">{eventInfo.title}</h2>
                  <div className="space-y-2 text-sm text-gray-600">
                    {eventInfo.date && (
                      <p>
                        <strong>Date:</strong>{' '}
                        {new Date(eventInfo.date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    )}
                    {eventInfo.venue && <p><strong>Venue:</strong> {eventInfo.venue}</p>}
                  </div>
                </div>
              )}

              <h3 className="text-2xl font-bold mb-6">
                Your Tickets ({tickets.length})
              </h3>

              <div className="space-y-4">
                {tickets.map((ticket, index) => (
                  <div
                    key={index}
                    className="border border-gray-300 rounded-lg p-6 bg-gray-50"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold text-lg">Ticket {index + 1}</h4>
                      <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm">
                        {ticket.ticket_type}
                      </span>
                    </div>

                    <div className="mb-4 p-3 bg-white rounded border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Ticket Code</p>
                      <p className="font-mono text-base font-bold text-blue-600">
                        {ticket.ticket_code}
                      </p>
                    </div>

                    <div className="text-center py-4">
                      <img
                        src={ticket.qr_code_data}
                        alt={`QR Code for Ticket ${index + 1}`}
                        className="w-48 h-48 mx-auto border border-gray-300 rounded"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Scan at event entry
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-bold text-blue-900 mb-2">📋 Tip:</h4>
                <p className="text-sm text-blue-800">
                  Save or screenshot these tickets for your records. You can use either the
                  ticket code or QR code at the event.
                </p>
              </div>
            </div>
          )}

          {!error && tickets.length === 0 && !loading && (
            <div className="text-center text-gray-500 py-8">
              <p>Enter your email or order ID to view your tickets</p>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-200">
            <Link
              href="/"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
