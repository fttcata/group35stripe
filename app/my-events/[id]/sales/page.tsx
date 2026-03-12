'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type SalesTotals = {
  completedRevenue: number;
  payNowRevenue: number;
  payOnDayRevenue: number;
  deferredRevenue: number;
  stripeFeesTotal: number;
  netRevenue: number;
};

type RevenueByType = {
  ticket_type: string;
  sold: number;
  revenue: number;
};

type SalesTimelinePoint = {
  date: string;
  tickets_sold: number;
};

type PayMethodBreakdown = {
  payNowCount: number;
  payOnDayCount: number;
};

type Transaction = {
  id: string;
  total_amount: number;
  payment_status: string;
  payment_method: string;
  created_at: string;
  customer_email: string | null;
};

type SalesResponse = {
  totals: SalesTotals;
  revenueByType: RevenueByType[];
  salesTimeline: SalesTimelinePoint[];
  payMethodBreakdown: PayMethodBreakdown;
  recentTransactions: Transaction[];
};

type EventResponse = {
  event: {
    id: string;
    title: string;
    date?: string;
    start_date?: string;
    venue?: string;
    status?: string;
    created_by?: string;
  };
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IE', { year: 'numeric', month: 'short', day: 'numeric' });
}

function LineChart({ data }: { data: SalesTimelinePoint[] }) {
  if (data.length === 0) {
    return <div className="text-sm text-gray-500">No sales yet.</div>;
  }

  const max = Math.max(...data.map((d) => d.tickets_sold), 1);
  const width = 640;
  const height = 180;
  const padding = 24;

  const points = data.map((point, index) => {
    const x = padding + (index / Math.max(1, data.length - 1)) * (width - padding * 2);
    const y = height - padding - (point.tickets_sold / max) * (height - padding * 2);
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full">
      <polyline fill="none" stroke="#2563eb" strokeWidth="3" points={points.join(' ')} />
      {data.map((point, index) => {
        const x = padding + (index / Math.max(1, data.length - 1)) * (width - padding * 2);
        const y = height - padding - (point.tickets_sold / max) * (height - padding * 2);
        return <circle key={`${point.date}-${index}`} cx={x} cy={y} r="4" fill="#2563eb" />;
      })}
    </svg>
  );
}

export default function EventSalesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<EventResponse['event'] | null>(null);
  const [sales, setSales] = useState<SalesResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadSales = async () => {
      setLoading(true);
      setError('');
      if (!params?.id) {
        setError('Event not found.');
        setLoading(false);
        return;
      }
      const supabase = createSupabaseBrowserClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const role = user.user_metadata?.role;
      if (role !== 'organizer') {
        router.push('/');
        return;
      }

      const eventRes = await fetch(`/api/events/${params.id}`);
      const eventData = (await eventRes.json()) as EventResponse;
      if (!eventRes.ok || !eventData?.event) {
        setError('Event not found.');
        setLoading(false);
        return;
      }

      if (eventData.event.created_by && eventData.event.created_by !== user.id) {
        setError('You do not have access to this event.');
        setLoading(false);
        return;
      }

      const salesRes = await fetch(`/api/events/${params.id}/sales`);
      const salesData = (await salesRes.json()) as SalesResponse;
      if (!salesRes.ok) {
        setError('Failed to load sales analytics.');
        setLoading(false);
        return;
      }

      setEvent(eventData.event);
      setSales(salesData);
      setLoading(false);
    };

    loadSales();
  }, [params, router]);

  const timelineSeries = useMemo(() => sales?.salesTimeline ?? [], [sales]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 px-6 py-10">
        <div className="mx-auto max-w-6xl rounded-xl bg-white p-6 shadow">
          <p className="text-gray-600">Loading sales analytics...</p>
        </div>
      </main>
    );
  }

  if (error || !sales || !event) {
    return (
      <main className="min-h-screen bg-gray-50 px-6 py-10">
        <div className="mx-auto max-w-4xl rounded-xl bg-white p-6 shadow">
          <p className="text-red-600">{error || 'No data available.'}</p>
          <Link href="/my-events" className="mt-4 inline-block text-blue-600 hover:underline">
            Back to My Events
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-xl bg-white p-6 shadow">
          <Link href="/my-events" className="text-sm text-blue-600 hover:underline">
            Back to My Events
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">{event.title}</h1>
          <p className="text-sm text-gray-600">
            {event.date || event.start_date ? formatDate(event.date || event.start_date || '') : 'Date TBA'} · {event.venue || 'Venue TBA'}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl bg-white p-4 shadow">
            <p className="text-xs text-gray-500">Gross Revenue</p>
            <p className="text-xl font-semibold text-gray-900">{formatCurrency(sales.totals.completedRevenue)}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow">
            <p className="text-xs text-gray-500">Net Revenue</p>
            <p className="text-xl font-semibold text-gray-900">{formatCurrency(sales.totals.netRevenue)}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow">
            <p className="text-xs text-gray-500">Stripe Fees</p>
            <p className="text-xl font-semibold text-gray-900">{formatCurrency(sales.totals.stripeFeesTotal)}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow">
            <p className="text-xs text-gray-500">Pay Now Revenue</p>
            <p className="text-xl font-semibold text-gray-900">{formatCurrency(sales.totals.payNowRevenue)}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow">
            <p className="text-xs text-gray-500">Pay on Day Revenue</p>
            <p className="text-xl font-semibold text-gray-900">{formatCurrency(sales.totals.payOnDayRevenue)}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow">
            <p className="text-xs text-gray-500">Deferred (Expected)</p>
            <p className="text-xl font-semibold text-gray-900">{formatCurrency(sales.totals.deferredRevenue)}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900">Sales Timeline</h2>
            <p className="text-sm text-gray-500">Tickets sold per day.</p>
            <div className="mt-4">
              <LineChart data={timelineSeries} />
            </div>
          </div>
          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900">Pay Now vs Pay on Day</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Pay Now Orders</span>
                <span className="font-semibold">{sales.payMethodBreakdown.payNowCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Pay on Day Orders</span>
                <span className="font-semibold">{sales.payMethodBreakdown.payOnDayCount}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900">Revenue by Ticket Type</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-2">Ticket Type</th>
                    <th className="py-2">Sold</th>
                    <th className="py-2">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.revenueByType.map((row) => (
                    <tr key={row.ticket_type} className="border-b last:border-b-0">
                      <td className="py-2">{row.ticket_type}</td>
                      <td className="py-2">{row.sold}</td>
                      <td className="py-2">{formatCurrency(row.revenue)}</td>
                    </tr>
                  ))}
                  {sales.revenueByType.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-4 text-gray-500">No sales yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
            <div className="mt-4 space-y-3 text-sm">
              {sales.recentTransactions.length === 0 && (
                <p className="text-gray-500">No transactions yet.</p>
              )}
              {sales.recentTransactions.map((tx) => (
                <div key={tx.id} className="rounded-lg border border-gray-200 p-3">
                  <p className="font-semibold text-gray-900">{formatCurrency(tx.total_amount)}</p>
                  <p className="text-xs text-gray-500">{formatDate(tx.created_at)}</p>
                  <p className="text-xs text-gray-500">{tx.payment_method} · {tx.payment_status}</p>
                  <p className="text-xs text-gray-500">{tx.customer_email || 'No email on record'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
