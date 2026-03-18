'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface InviteRow {
  id: string;
  invited_email: string;
  invite_code: string;
  status: 'pending' | 'claimed' | 'revoked';
  created_at: string;
  claimed_at?: string;
  expires_at?: string;
}

export default function ManageEventStaffPage() {
  const params = useParams<{ id: string }>();
  const eventId = useMemo(() => String(params?.id || ''), [params]);

  const [emailsInput, setEmailsInput] = useState('');
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadInvites = async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/staff/invites?eventId=${encodeURIComponent(eventId)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load invites');
      }
      setInvites(data.invites || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invites');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvites();
  }, [eventId]);

  const handleSendInvites = async () => {
    const emails = emailsInput
      .split(/[\s,;\n]+/)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    if (emails.length === 0) {
      setError('Enter at least one email address.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/staff/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, emails }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send invites');
      }

      const invitedCount = Array.isArray(data.invited) ? data.invited.length : 0;
      const failedCount = Array.isArray(data.failed) ? data.failed.length : 0;

      setSuccess(`Sent ${invitedCount} invite(s). ${failedCount > 0 ? `${failedCount} failed.` : ''}`.trim());
      setEmailsInput('');
      await loadInvites();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invites');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Manage Event Staff</h1>
            <p className="text-gray-600 mt-1">Invite staff by email and track claimed activation codes.</p>
          </div>
          <Link href="/my-events" className="text-indigo-600 hover:text-indigo-700 font-semibold">
            Back to My Events
          </Link>
        </div>

        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900">Invite Staff</h2>
          <p className="text-sm text-gray-500 mt-1">Paste one or more email addresses separated by commas, spaces, or new lines.</p>

          <textarea
            value={emailsInput}
            onChange={(e) => setEmailsInput(e.target.value)}
            placeholder="staff1@example.com, staff2@example.com"
            className="mt-3 w-full min-h-28 rounded-lg border border-gray-300 px-3 py-2"
          />

          <button
            onClick={handleSendInvites}
            disabled={saving}
            className="mt-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold px-4 py-2"
          >
            {saving ? 'Sending...' : 'Send Staff Invites'}
          </button>

          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
          {success && <p className="mt-3 text-sm text-green-700">{success}</p>}
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900">Invite Status</h2>

          {loading ? (
            <p className="text-gray-500 mt-3">Loading invites...</p>
          ) : invites.length === 0 ? (
            <p className="text-gray-500 mt-3">No invites yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Code</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((invite) => (
                    <tr key={invite.id} className="border-b border-gray-100">
                      <td className="py-2 pr-3 text-gray-900">{invite.invited_email}</td>
                      <td className="py-2 pr-3 font-mono text-gray-900">{invite.invite_code}</td>
                      <td className="py-2 pr-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${invite.status === 'claimed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {invite.status}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-gray-600">{new Date(invite.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
