'use client';

import { useEffect, useState } from 'react';
import { loadStripeTerminal } from '@stripe/terminal-js';
import type { Reader, Terminal } from '@stripe/terminal-js';
import Link from 'next/link';

export default function StaffTerminalPage() {
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

  async function discoverReaders() {
    if (!terminal) { setError('Terminal is not initialized yet.'); return; }
    try {
      setError(null);
      setStatus('Discovering readers...');
      const result = await terminal.discoverReaders({ simulated });
      if ('error' in result) throw new Error(result.error.message);
      setDiscoveredReaders(result.discoveredReaders || []);
      setStatus(`Found ${result.discoveredReaders?.length || 0} reader(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discovery failed');
    }
  }

  async function connectReader(reader: Reader) {
    if (!terminal) { setError('Terminal is not initialized yet.'); return; }
    setIsBusy(true);
    setStatus('Connecting...');
    try {
      setError(null);
      const result = await terminal.connectReader(reader);
      if ('error' in result) throw new Error(result.error.message);
      setConnectedReader(reader);
      setReaderLabel(reader.label);
      setStatus(`Connected to ${reader.label}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 antialiased">
      <header className="bg-white border-b border-slate-200 p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Stripe Terminal Reader</h1>
            <p className="text-slate-500 mt-1">Manage your payment reader connection</p>
          </div>
          <Link href="/staff" className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">
            Scan Tickets
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Status */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-bold mb-2">Reader Status</h2>
          <p className={`text-sm ${connectedReader ? 'text-green-600' : 'text-yellow-600'}`}>
            {connectedReader ? `✓ Connected to: ${readerLabel}` : status}
          </p>
          {error && <p className="text-red-600 text-sm mt-2">Error: {error}</p>}
        </div>

        {/* Reader Discovery */}
        {!connectedReader && (
          <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
            <h2 className="text-lg font-bold mb-4">Connect a Reader</h2>

            {/* Simulated / Real Toggle */}
            <div className="mb-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={simulated}
                  onChange={(e) => setSimulated(e.target.checked)}
                  disabled={isBusy}
                  className="rounded"
                />
                <span className="text-sm text-slate-600">Use Simulated Reader (for testing)</span>
              </label>
            </div>

            {/* Discover Button */}
            <button
              onClick={discoverReaders}
              disabled={isBusy}
              className="w-full mb-4 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-300 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              {isBusy ? 'Discovering...' : 'Discover Readers'}
            </button>

            {/* Discovered Readers */}
            {discoveredReaders.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-slate-600 font-semibold">Available Readers:</p>
                {discoveredReaders.map((reader) => (
                  <button
                    key={reader.id}
                    onClick={() => connectReader(reader)}
                    disabled={isBusy}
                    className="w-full text-left bg-slate-50 hover:bg-slate-100 disabled:bg-slate-200 border border-slate-200 rounded-lg p-3 font-medium text-slate-900"
                  >
                    {reader.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Connected State */}
        {connectedReader && (
          <div className="bg-green-50 border-2 border-green-400 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-green-900 mb-4">✓ Reader Connected</h2>
            <p className="text-green-800 mb-6">
              The reader is ready. Staff can now scan tickets using the mobile scanner to initiate check-in or payments.
            </p>

            <Link
              href="/staff"
              className="inline-block bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg"
            >
              📱 Go to Ticket Scanner
            </Link>

            <div className="mt-6 pt-6 border-t border-green-300">
              <p className="text-sm text-green-700">
                <strong>Waiting for scans...</strong> Staff members with mobile devices can navigate to the scanner to begin check-ins.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
