'use client';

import { useEffect, useMemo, useState } from 'react';
import { loadStripeTerminal } from '@stripe/terminal-js';
import type { Reader, Terminal } from '@stripe/terminal-js';

interface OrderLookupResponse {
  orderId: string;
  event: {
    title?: string;
    date?: string;
    venue?: string;
  } | null;
  tickets: Array<{
    id: string;
    is_used: boolean;
  }>;
  paymentStatus: string;
  totalAmount: number;
}

export default function TerminalPanel() {
  const [orderIdInput, setOrderIdInput] = useState('');
  const [order, setOrder] = useState<OrderLookupResponse | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [readerLabel, setReaderLabel] = useState('');
  const [simulated, setSimulated] = useState(true);
  const [status, setStatus] = useState('Initialize Stripe Terminal to begin.');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [discoveredReaders, setDiscoveredReaders] = useState<Reader[]>([]);
  const [connectedReader, setConnectedReader] = useState<Reader | null>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);

  useEffect(() => {
    let mounted = true;

    const setupTerminal = async () => {
      try {
        const StripeTerminal = await loadStripeTerminal();
        if (!StripeTerminal) {
          throw new Error('Failed to load Stripe Terminal SDK');
        }

        const terminalInstance = StripeTerminal.create({
          onFetchConnectionToken: async () => {
            const res = await fetch('/api/terminal/connection-token', { method: 'POST' });
            const data = await res.json();
            if (!res.ok || !data.secret) {
              throw new Error(data.error || 'Failed to fetch connection token');
            }
            return data.secret as string;
          },
          onUnexpectedReaderDisconnect: () => {
            setConnectedReader(null);
            setStatus('Reader disconnected unexpectedly.');
          },
        });

        if (mounted) {
          setTerminal(terminalInstance);
          setStatus('Stripe Terminal initialized. Discover readers to continue.');
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize Stripe Terminal');
        }
      }
    };

    setupTerminal();
    return () => {
      mounted = false;
    };
  }, []);

  const amountDueCents = useMemo(() => {
    if (!order) return 0;
    return Math.round(Number(order.totalAmount || 0) * 100);
  }, [order]);

  async function lookupOrder() {
    try {
      setError(null);
      setStatus('Looking up order...');
      const id = orderIdInput.trim();
      if (!id) {
        setError('Order ID is required.');
        return;
      }

      const res = await fetch(`/api/tickets?orderId=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to load order');
      }

      setOrder(data as OrderLookupResponse);
      setStatus('Order loaded. Discover and connect a reader.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order lookup failed');
    }
  }

  async function performSearch() {
    try {
      setError(null);
      setStatus('Searching...');
      const q = searchInput.trim();
      if (!q) {
        setSearchResults([]);
        setStatus('Enter a name, email, or ticket ID to search.');
        return;
      }

      const res = await fetch(`/api/staff/search?search=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setSearchResults(Array.isArray(data.results) ? data.results : []);
      setStatus(`Found ${Array.isArray(data.results) ? data.results.length : 0} result(s)`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    }
  }

  async function checkInOrder(orderId: string) {
    try {
      setError(null);
      setStatus('Checking in tickets...');
      const res = await fetch(`/api/staff/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Check-in failed');
      setStatus(data.message || `Checked in ${data.checkedInCount || 0} ticket(s)`);
      await performSearch();
      if (order && order.orderId === orderId) {
        await lookupOrder();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-in failed');
    }
  }

  async function loadOrderById(id: string) {
    try {
      setError(null);
      setStatus('Looking up order...');
      const res = await fetch(`/api/tickets?orderId=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to load order');
      }
      setOrder(data as OrderLookupResponse);
      setStatus('Order loaded. Discover and connect a reader.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order lookup failed');
    }
  }

  async function discoverReaders() {
    if (!terminal) {
      setError('Terminal is not initialized yet.');
      return;
    }

    try {
      setError(null);
      setStatus('Discovering readers...');
      const result = await terminal.discoverReaders({ simulated });
      if ('error' in result) {
        throw new Error(result.error.message);
      }
      setDiscoveredReaders(result.discoveredReaders || []);
      setStatus(`Discovered ${(result.discoveredReaders || []).length} reader(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover readers');
    }
  }

  async function connectReader(reader: Reader) {
    if (!terminal) {
      setError('Terminal is not initialized yet.');
      return;
    }

    try {
      setError(null);
      setStatus(`Connecting to reader ${reader.label || reader.serial_number || reader.id}...`);
      const result = await terminal.connectReader(reader);
      if ('error' in result) {
        throw new Error(result.error.message);
      }
      setConnectedReader(result.reader || reader);
      setReaderLabel(result.reader?.label || reader.label || reader.id);
      setStatus('Reader connected. Ready to collect payment.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect reader');
    }
  }

  async function processTerminalPayment() {
    if (!terminal) {
      setError('Terminal is not initialized yet.');
      return;
    }
    if (!connectedReader) {
      setError('Connect a reader first.');
      return;
    }
    if (!order) {
      setError('Load an order first.');
      return;
    }

    try {
      setIsBusy(true);
      setError(null);
      setStatus('Creating terminal payment intent...');

      const createIntentRes = await fetch(`/api/terminal/orders/${order.orderId}/intent`, {
        method: 'POST',
      });
      const createIntentData = await createIntentRes.json();
      if (!createIntentRes.ok) {
        throw new Error(createIntentData.error || 'Failed to create payment intent');
      }
      const displayCurrency = String(createIntentData.currency || 'eur').toLowerCase();

      if (amountDueCents > 0) {
        await terminal.setReaderDisplay({
          type: 'cart',
          cart: {
            line_items: [
              {
                description: order.event?.title || 'Event Ticket',
                amount: amountDueCents,
                quantity: 1,
              },
            ],
            tax: 0,
            total: amountDueCents,
            currency: displayCurrency,
          },
        });
      }

      setStatus('Present card to reader...');
      const collectResult = await terminal.collectPaymentMethod(createIntentData.clientSecret);
      if ('error' in collectResult) {
        throw new Error(collectResult.error.message);
      }

      setStatus('Processing payment...');
      const processResult = await terminal.processPayment(collectResult.paymentIntent);
      if ('error' in processResult) {
        throw new Error(processResult.error.message);
      }

      const finalizeRes = await fetch(`/api/terminal/orders/${order.orderId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentIntentId: processResult.paymentIntent.id,
        }),
      });
      const finalizeData = await finalizeRes.json();
      if (!finalizeRes.ok) {
        throw new Error(finalizeData.error || 'Failed to finalize payment/check-in');
      }

      setStatus(
        `Payment complete. Checked in ${finalizeData.checkedInCount} ticket(s). Receipt email ${finalizeData.receiptEmailMessageId ? 'sent' : 'attempted'}.`
      );
      await lookupOrder();
      await terminal.clearReaderDisplay();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terminal payment failed');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="w-full bg-white rounded-xl p-4 shadow">
      <h3 className="mb-3 text-lg font-semibold text-gray-900">Staff Tools — Terminal & Check-In</h3>

      <div className="mb-4">
        <div className="mb-2 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, email, or ticket ID"
            className="rounded border border-gray-300 px-3 py-2"
          />
          <button
            type="button"
            onClick={performSearch}
            className="rounded bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
          >
            Search
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="mb-3 space-y-2">
            {searchResults.map((r) => (
              <div key={r.orderId} className="flex items-start justify-between rounded border border-gray-200 px-3 py-2 text-sm">
                <div>
                  <p className="font-semibold">{r.eventTitle} — {r.guestName || r.customerEmail}</p>
                  <p className="text-gray-500">Order: {r.orderId} — ${Number(r.totalAmount || 0).toFixed(2)}</p>
                  <p className="text-gray-500">Unchecked-in: {r.unCheckedInCount}</p>
                  <div className="mt-1 text-xs">
                    {Array.isArray(r.tickets) && r.tickets.slice(0,5).map((t:any) => (
                      <span key={t.id} className="mr-2 inline-block rounded bg-gray-100 px-2 py-0.5">{t.ticketCode} {t.isUsed ? '(used)' : ''}</span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setOrderIdInput(r.orderId); loadOrderById(r.orderId); }}
                    className="rounded border border-gray-300 px-3 py-1.5 text-sm font-semibold hover:bg-gray-100"
                  >
                    View Order
                  </button>
                  <button
                    type="button"
                    onClick={() => checkInOrder(r.orderId)}
                    className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    Check In
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            value={orderIdInput}
            onChange={(e) => setOrderIdInput(e.target.value)}
            placeholder="Order ID (UUID)"
            className="rounded border border-gray-300 px-3 py-2"
          />
          <button
            type="button"
            onClick={lookupOrder}
            className="rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
          >
            Load Order
          </button>
        </div>
      </div>

      {order && (
        <div className="mb-4 rounded border border-gray-200 bg-gray-50 p-3 text-sm">
          <p><strong>Order:</strong> {order.orderId}</p>
          <p><strong>Event:</strong> {order.event?.title || 'Event Ticket'}</p>
          <p><strong>Amount Due:</strong> ${Number(order.totalAmount || 0).toFixed(2)}</p>
          <p><strong>Current Payment Status:</strong> {order.paymentStatus}</p>
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={simulated}
            onChange={(e) => setSimulated(e.target.checked)}
          />
          Use simulated reader
        </label>
        <button
          type="button"
          onClick={discoverReaders}
          className="rounded border border-gray-300 px-3 py-2 text-sm font-semibold hover:bg-gray-100"
        >
          Discover Readers
        </button>
      </div>

      {discoveredReaders.length > 0 && (
        <div className="mb-6 space-y-2">
          {discoveredReaders.map((reader) => (
            <div key={reader.id} className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm">
              <div>
                <p className="font-semibold">{reader.label || reader.serial_number || reader.id}</p>
                <p className="text-gray-500">{reader.device_type || reader.location || 'Reader'}</p>
              </div>
              <button
                type="button"
                onClick={() => connectReader(reader)}
                className="rounded bg-gray-900 px-3 py-1.5 font-semibold text-white hover:bg-black"
              >
                Connect
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 rounded border border-gray-200 bg-white p-3 text-sm">
        <p><strong>Connected Reader:</strong> {readerLabel || connectedReader?.label || 'None'}</p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={isBusy || !order || !connectedReader}
          onClick={processTerminalPayment}
          className="rounded bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isBusy ? 'Processing...' : 'Collect Payment + Auto Check-In'}
        </button>
        <div className="mt-0 ml-auto text-sm">
          <p><strong>Status:</strong> {status}</p>
          {error && <p className="text-red-600"><strong>Error:</strong> {error}</p>}
        </div>
      </div>
    </div>
  );
}
