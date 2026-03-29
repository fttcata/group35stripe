'use client';

import { useState } from 'react';

type Props = {
  connected: boolean;
};

export default function StripeConnectButton({ connected }: Props) {
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || 'Failed to start Stripe Connect');
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Stripe Connect');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect your payout account?')) return;
    setDisconnecting(true);
    setError('');
    try {
      const res = await fetch('/api/stripe/disconnect', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to disconnect Stripe');
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect Stripe');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
      <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
          <p className="text-sm font-semibold text-indigo-900">Payout setup</p>
          <p className="text-xs text-indigo-700">
            {connected ? 'Payout account connected.' : 'Connect a payout account to receive earnings.'}
          </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleConnect}
              disabled={loading}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
            {loading ? 'Starting...' : connected ? 'Manage payouts' : 'Set up payouts'}
            </button>
          {connected && (
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
