'use client';

import { useEffect, useState } from 'react';
import { loadStripeTerminal } from '@stripe/terminal-js';
import type { Reader, Terminal, NumericResult, NumericInput, SelectionInput, SelectionResult } from '@stripe/terminal-js';

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
    check_in_code?: string;
  }>;
  paymentStatus: string;
  totalAmount: number;
}

export default function StaffTerminalPage() {
  const [readerLabel, setReaderLabel] = useState('');
  const [simulated, setSimulated] = useState(true);
  const [status, setStatus] = useState('Initialize Stripe Terminal to begin.');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [discoveredReaders, setDiscoveredReaders] = useState<Reader[]>([]);
  const [connectedReader, setConnectedReader] = useState<Reader | null>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [loopRunning, setLoopRunning] = useState(false);

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
            setLoopRunning(false);
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

  /* ──────────────── helpers ──────────────── */

  function selectionInput(title: string, description: string, buttons: { text: string; id: string; style?: string }[]): SelectionInput {
    return {
      formType: 'selection' as unknown as SelectionInput['formType'],
      required: false,
      title,
      description,
      selectionButtons: buttons.map(b => ({
        style: (b.style || 'primary') as unknown as SelectionInput['selectionButtons'][0]['style'],
        text: b.text,
        id: b.id,
      })),
    };
  }

  /** Show a message on the terminal with an OK button. Resolves when tapped. */
  async function showTerminalMessage(title: string, description: string): Promise<void> {
    if (!terminal) return;
    const input = selectionInput(title, description, [{ text: 'OK', id: 'ok' }]);
    await terminal.collectInputs({ inputs: [input] });
  }

  /** Show an error on the terminal with a "Try Again" button. Returns true if tapped. */
  async function showTerminalError(title: string, description: string): Promise<boolean> {
    if (!terminal) return false;
    const input = selectionInput(title, description, [{ text: 'Try Again', id: 'retry' }]);
    const result = await terminal.collectInputs({ inputs: [input] });
    if ('error' in result) return false;
    const sel = result[0] as SelectionResult;
    return !sel.skipped && sel.selectionId === 'retry';
  }

  async function lookupByCode(code: string): Promise<OrderLookupResponse> {
    const res = await fetch(`/api/tickets?checkInCode=${encodeURIComponent(code)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || 'Lookup failed');
    return data as OrderLookupResponse;
  }

  async function checkInOnly(code: string): Promise<{ success: boolean; error?: string; alreadyUsed?: boolean }> {
    const res = await fetch('/api/terminal/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkInCode: code }),
    });
    return res.json();
  }

  /* ──────────────── main loop ──────────────── */

  async function startCheckInLoop() {
    if (!terminal || !connectedReader) {
      setError('Connect a reader first.');
      return;
    }

    setLoopRunning(true);
    setIsBusy(true);
    setError(null);

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        setStatus('Waiting for check-in code...');

        /* ── 1. Collect 6-digit code on the terminal keypad ── */
        const numericInput: NumericInput = {
          formType: 'numeric' as unknown as NumericInput['formType'],
          required: true,
          title: 'Check-In Code',
          description: 'Enter the 6-digit code from the customer\'s ticket',
          submitButtonText: 'Submit',
        };

        const inputResult = await terminal.collectInputs({ inputs: [numericInput] });

        if ('error' in inputResult) throw new Error(inputResult.error.message);

        const numericResult = inputResult[0] as NumericResult;
        if (numericResult.skipped || !numericResult.numericString) {
          // Staff pressed skip — exit loop
          setStatus('Check-in mode ended.');
          break;
        }

        const code = numericResult.numericString.trim();

        /* ── 2. Validate format ── */
        if (!/^\d{6}$/.test(code)) {
          const retry = await showTerminalError('Invalid Code', `"${code}" is not a valid 6-digit code.`);
          if (!retry) break;
          continue;
        }

        /* ── 3. Look up order ── */
        let orderData: OrderLookupResponse;
        try {
          orderData = await lookupByCode(code);
        } catch {
          const retry = await showTerminalError('Code Not Found', `No ticket found for code ${code}.`);
          if (!retry) break;
          continue;
        }

        setStatus(`Found order ${orderData.orderId}`);

        /* ── 4. Determine ticket state ── */
        const ticket = orderData.tickets.find(t => t.check_in_code === code);
        const isAlreadyUsed = ticket?.is_used === true;
        const isPaid = orderData.paymentStatus === 'completed' || orderData.paymentStatus === 'paid';

        /* ── 4a. Already checked in ── */
        if (isAlreadyUsed) {
          await showTerminalError('Already Checked In', `Code ${code} has already been used.`);
          // always loop back to code entry regardless of button tap
          continue;
        }

        /* ── 4b. Already paid → just check in ── */
        if (isPaid) {
          setStatus('Ticket is paid. Checking in...');
          const checkinResult = await checkInOnly(code);

          if (checkinResult.alreadyUsed) {
            await showTerminalError('Already Checked In', `Code ${code} has already been used.`);
            continue;
          }

          if (!checkinResult.success) {
            const retry = await showTerminalError('Check-In Failed', checkinResult.error || 'Unknown error.');
            if (!retry) break;
            continue;
          }

          setStatus('Checked in!');
          await showTerminalMessage('✓ Checked In!', `${orderData.event?.title || 'Event Ticket'}\nCode ${code} — Welcome!`);
          continue; // back to code entry
        }

        /* ── 4c. Pay on day → collect payment, then check in ── */
        const amountCents = Math.round(Number(orderData.totalAmount || 0) * 100);
        const amountFormatted = Number(orderData.totalAmount || 0).toFixed(2);
        setStatus(`€${amountFormatted} due — presenting payment screen...`);

        try {
          // Create payment intent
          const intentRes = await fetch(`/api/terminal/orders/${orderData.orderId}/intent`, { method: 'POST' });
          const intentData = await intentRes.json();
          if (!intentRes.ok) throw new Error(intentData.error || 'Failed to create payment intent');

          const displayCurrency = String(intentData.currency || 'eur').toLowerCase();

          // Show cart on reader
          if (amountCents > 0) {
            await terminal.setReaderDisplay({
              type: 'cart',
              cart: {
                line_items: [{
                  description: orderData.event?.title || 'Event Ticket',
                  amount: amountCents,
                  quantity: 1,
                }],
                tax: 0,
                total: amountCents,
                currency: displayCurrency,
              },
            });
          }

          // Collect card
          setStatus('Present card to reader...');
          const collectResult = await terminal.collectPaymentMethod(intentData.clientSecret);
          if ('error' in collectResult) throw new Error(collectResult.error.message);

          // Process payment
          setStatus('Processing payment...');
          const processResult = await terminal.processPayment(collectResult.paymentIntent);
          if ('error' in processResult) throw new Error(processResult.error.message);

          // Finalize on server (updates order + checks in tickets)
          setStatus('Finalizing...');
          const finalizeRes = await fetch(`/api/terminal/orders/${orderData.orderId}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentIntentId: processResult.paymentIntent.id }),
          });
          const finalizeData = await finalizeRes.json();
          if (!finalizeRes.ok) throw new Error(finalizeData.error || 'Failed to finalize');

          setStatus('Payment complete!');
          await terminal.clearReaderDisplay();
          await showTerminalMessage('✓ Checked In!', `Payment of €${amountFormatted} received.\n${orderData.event?.title || 'Event Ticket'}\nCode ${code} — Welcome!`);
          // loop back to code entry
          continue;
        } catch (payErr) {
          // Payment failed/cancelled/timed out — do NOT update DB, go back to code entry
          const msg = payErr instanceof Error ? payErr.message : 'Payment failed';
          setError(msg);
          setStatus('Payment not completed. Returning to code entry...');
          await terminal.clearReaderDisplay();
          await showTerminalError('Payment Failed', `${msg}\n\nThe order was NOT checked in.`);
          setError(null);
          continue;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terminal error');
    } finally {
      setIsBusy(false);
      setLoopRunning(false);
    }
  }

  /* ──────────────── reader management ──────────────── */

  async function discoverReaders() {
    if (!terminal) { setError('Terminal is not initialized yet.'); return; }
    try {
      setError(null);
      setStatus('Discovering readers...');
      const result = await terminal.discoverReaders({ simulated });
      if ('error' in result) throw new Error(result.error.message);
      setDiscoveredReaders(result.discoveredReaders || []);
      setStatus(`Discovered ${(result.discoveredReaders || []).length} reader(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover readers');
    }
  }

  async function connectReader(reader: Reader) {
    if (!terminal) { setError('Terminal is not initialized yet.'); return; }
    try {
      setError(null);
      setStatus(`Connecting to ${reader.label || reader.serial_number || reader.id}...`);
      const result = await terminal.connectReader(reader);
      if ('error' in result) throw new Error(result.error.message);
      setConnectedReader(result.reader || reader);
      setReaderLabel(result.reader?.label || reader.label || reader.id);
      setStatus('Reader connected. Press "Start Check-In" to begin.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect reader');
    }
  }

  /* ──────────────── render ──────────────── */

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-4xl rounded-xl bg-white p-6 shadow">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Stripe Terminal Check-In</h1>
        <p className="mb-6 text-sm text-gray-600">
          Connect a reader, then press &quot;Start Check-In&quot;. The terminal will continuously prompt for 6-digit codes. Already-paid tickets are checked in instantly. Pay-on-day tickets go straight to payment.
        </p>

        {/* Reader setup */}
        <div className="mb-4 flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={simulated} onChange={(e) => setSimulated(e.target.checked)} />
            Use simulated reader
          </label>
          <button type="button" onClick={discoverReaders} disabled={loopRunning}
            className="rounded border border-gray-300 px-3 py-2 text-sm font-semibold hover:bg-gray-100 disabled:opacity-50">
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
                <button type="button" onClick={() => connectReader(reader)} disabled={loopRunning}
                  className="rounded bg-gray-900 px-3 py-1.5 font-semibold text-white hover:bg-black disabled:opacity-50">
                  Connect
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mb-4 rounded border border-gray-200 bg-white p-3 text-sm">
          <p><strong>Connected Reader:</strong> {readerLabel || connectedReader?.label || 'None'}</p>
        </div>

        {/* Main action */}
        <button type="button" disabled={isBusy || !connectedReader} onClick={startCheckInLoop}
          className="rounded bg-blue-600 px-6 py-3 text-lg font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
          {loopRunning ? 'Check-In Mode Active...' : 'Start Check-In'}
        </button>

        {/* Status */}
        <div className="mt-6 space-y-2 text-sm">
          <p><strong>Status:</strong> {status}</p>
          {error && <p className="text-red-600"><strong>Error:</strong> {error}</p>}
        </div>
      </div>
    </main>
  );
}
