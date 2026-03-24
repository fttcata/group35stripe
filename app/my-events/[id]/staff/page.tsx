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

interface CoOrganizerRow {
  id: string;
  user_id: string;
  email: string;
  name: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
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

  // Co-organizer state
  const [coOrgEmail, setCoOrgEmail] = useState('');
  const [coOrganizers, setCoOrganizers] = useState<CoOrganizerRow[]>([]);
  const [coOrgLoading, setCoOrgLoading] = useState(true);
  const [coOrgSaving, setCoOrgSaving] = useState(false);
  const [coOrgError, setCoOrgError] = useState<string | null>(null);
  const [coOrgSuccess, setCoOrgSuccess] = useState<string | null>(null);

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
    loadCoOrganizers();
  }, [eventId]);

  const loadCoOrganizers = async () => {
    if (!eventId) return;
    setCoOrgLoading(true);
    try {
      const res = await fetch(`/api/co-organizers?eventId=${encodeURIComponent(eventId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load co-organizers');
      setCoOrganizers(data.coOrganizers || []);
    } catch {
      setCoOrganizers([]);
    } finally {
      setCoOrgLoading(false);
    }
  };

  const handleInviteCoOrganizer = async () => {
    const email = coOrgEmail.trim().toLowerCase();
    if (!email) {
      setCoOrgError('Enter an email address.');
      return;
    }

    setCoOrgSaving(true);
    setCoOrgError(null);
    setCoOrgSuccess(null);

    try {
      const res = await fetch('/api/co-organizers/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send invite');

      setCoOrgSuccess(`Invitation sent to ${data.inviteeEmail || email}.`);
      setCoOrgEmail('');
      await loadCoOrganizers();
    } catch (err) {
      setCoOrgError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setCoOrgSaving(false);
    }
  };

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
    <main className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Manage Event Staff</h1>
            <p className="text-slate-500 mt-1">Invite staff by email and track claimed activation codes.</p>
          </div>
          <Link href="/my-events" className="text-indigo-500 hover:text-indigo-600 font-semibold">
            Back to My Events
          </Link>
        </div>

        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900">Invite Staff</h2>
          <p className="text-sm text-slate-500 mt-1">Paste one or more email addresses separated by commas, spaces, or new lines.</p>

          <textarea
            value={emailsInput}
            onChange={(e) => setEmailsInput(e.target.value)}
            placeholder="staff1@example.com, staff2@example.com"
            className="mt-3 w-full min-h-28 rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
          />

          <button
            onClick={handleSendInvites}
            disabled={saving}
            className="mt-3 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-300 text-white font-semibold px-4 py-2 transition-colors"
          >
            {saving ? 'Sending...' : 'Send Staff Invites'}
          </button>

          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
          {success && <p className="mt-3 text-sm text-green-700">{success}</p>}
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900">Invite Status</h2>

          {loading ? (
            <p className="text-slate-500 mt-3">Loading invites...</p>
          ) : invites.length === 0 ? (
            <p className="text-slate-500 mt-3">No invites yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Code</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((invite) => (
                    <tr key={invite.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 text-slate-900">{invite.invited_email}</td>
                      <td className="py-2 pr-3 font-mono text-slate-900">{invite.invite_code}</td>
                      <td className="py-2 pr-3">
                        <span className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-semibold ${invite.status === 'claimed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {invite.status}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-500">{new Date(invite.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Co-Organizer Management */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900">Co-Organizers</h2>
          <p className="text-sm text-slate-500 mt-1">Invite other organizer accounts to co-manage this event.</p>

          <div className="mt-3 flex gap-2">
            <input
              type="email"
              value={coOrgEmail}
              onChange={(e) => setCoOrgEmail(e.target.value)}
              placeholder="co-organizer@example.com"
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleInviteCoOrganizer()}
            />
            <button
              onClick={handleInviteCoOrganizer}
              disabled={coOrgSaving}
              className="rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-300 text-white font-semibold px-4 py-2 transition-colors whitespace-nowrap"
            >
              {coOrgSaving ? 'Sending...' : 'Invite Co-Organizer'}
            </button>
          </div>

          {coOrgError && <p className="mt-3 text-sm text-red-700">{coOrgError}</p>}
          {coOrgSuccess && <p className="mt-3 text-sm text-green-700">{coOrgSuccess}</p>}

          {coOrgLoading ? (
            <p className="text-slate-500 mt-4">Loading co-organizers...</p>
          ) : coOrganizers.length === 0 ? (
            <p className="text-slate-500 mt-4">No co-organizers yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Invited</th>
                  </tr>
                </thead>
                <tbody>
                  {coOrganizers.map((co) => (
                    <tr key={co.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 text-slate-900">{co.email}</td>
                      <td className="py-2 pr-3 text-slate-900">{co.name || '—'}</td>
                      <td className="py-2 pr-3">
                        <span className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-semibold ${
                          co.status === 'accepted'
                            ? 'bg-emerald-100 text-emerald-700'
                            : co.status === 'declined'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {co.status}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-500">{new Date(co.created_at).toLocaleString()}</td>
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
