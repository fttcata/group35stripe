'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

type EventOption = {
  id: string;
  title: string;
  start_date: string;
  status: 'draft' | 'published';
};

type Summary = {
  totalEvents: number;
  publishedEvents: number;
  draftEvents: number;
  totalOrders: number;
  paidOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  uniqueBuyers: number;
  totalTicketsIssued: number;
  totalTicketsCheckedIn: number;
  checkInRatePct: number;
};

type EventMetric = {
  eventId: string;
  title: string;
  status: 'draft' | 'published';
  startDate: string;
  orders: number;
  paidOrders: number;
  pendingOrders: number;
  revenue: number;
  ticketsIssued: number;
  ticketsCheckedIn: number;
};

type TicketTypeMetric = {
  type: string;
  count: number;
  checkedIn: number;
};

type HourlyPurchase = { hour: number; count: number; revenue: number };
type HourlyCheckin = { hour: number; count: number };
type DailyPurchase = { day: string; orders: number; revenue: number };
type PaymentMethodMetric = { method: string; count: number; revenue: number };

type InsightsPayload = {
  events: EventOption[];
  summary: Summary;
  byEvent: EventMetric[];
  byTicketType: TicketTypeMetric[];
  purchasesByHour: HourlyPurchase[];
  checkinsByHour: HourlyCheckin[];
  purchasesByDay: DailyPurchase[];
  paymentMethodBreakdown: PaymentMethodMetric[];
};

type WidgetKey =
  | 'summary'
  | 'events'
  | 'ticketTypes'
  | 'hourlyPurchases'
  | 'hourlyCheckins'
  | 'dailyTrend'
  | 'paymentMethods';

const defaultWidgets: Record<WidgetKey, boolean> = {
  summary: true,
  events: true,
  ticketTypes: true,
  hourlyPurchases: true,
  hourlyCheckins: true,
  dailyTrend: true,
  paymentMethods: true,
};

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function RechartsBarCard({
  title,
  data,
  xKey,
  yKey,
  barColor,
  yTickFormatter,
  tooltipFormatter,
}: {
  title: string;
  data: Record<string, string | number>[];
  xKey: string;
  yKey: string;
  barColor: string;
  yTickFormatter?: (value: number) => string;
  tooltipFormatter?: (value: number) => string;
}) {
  const hasData = data.length > 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>

      {!hasData && (
        <p className="text-sm text-slate-500">No data in this filter.</p>
      )}

      {hasData && (
        <div className="h-64 rounded-lg border border-slate-200 bg-slate-50 p-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 16, left: 8, bottom: 6 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
              <XAxis
                dataKey={xKey}
                stroke="#475569"
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#475569"
                tick={{ fontSize: 11 }}
                tickFormatter={yTickFormatter}
                width={56}
              />
              <Tooltip
                formatter={(value: number) => (tooltipFormatter ? tooltipFormatter(Number(value)) : Number(value))}
                contentStyle={{ borderRadius: 10, borderColor: '#cbd5e1' }}
                labelStyle={{ color: '#0f172a', fontWeight: 600 }}
              />
              <Bar dataKey={yKey} fill={barColor} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function RechartsCategoryBarCard({
  title,
  data,
  xKey,
  yKey,
  barColor,
  valueFormatter,
}: {
  title: string;
  data: Record<string, string | number>[];
  xKey: string;
  yKey: string;
  barColor: string;
  valueFormatter?: (value: number) => string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      {data.length === 0 ? (
        <p className="text-sm text-slate-500">No data in this filter.</p>
      ) : (
        <div className="h-64 rounded-lg border border-slate-200 bg-slate-50 p-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 16, left: 8, bottom: 6 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
              <XAxis
                dataKey={xKey}
                stroke="#475569"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={52}
              />
              <YAxis stroke="#475569" tick={{ fontSize: 11 }} width={56} />
              <Tooltip
                formatter={(value: number) =>
                  valueFormatter ? valueFormatter(Number(value)) : Number(value)
                }
                contentStyle={{ borderRadius: 10, borderColor: '#cbd5e1' }}
                labelStyle={{ color: '#0f172a', fontWeight: 600 }}
              />
              <Bar dataKey={yKey} fill={barColor} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function CompactMetricList({
  rows,
}: {
  rows: Array<{ label: string; detail: string }>;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold mb-3">Quick Details</h2>
      <div className="space-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
            <span className="text-slate-600">{row.label}</span>
            <span className="font-semibold text-slate-800">{row.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OrganizerInsightsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<InsightsPayload | null>(null);

  const [selectedEventId, setSelectedEventId] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [widgets, setWidgets] = useState(defaultWidgets);

  useEffect(() => {
    const loadInsights = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('eventId', selectedEventId);
        if (fromDate) params.set('from', fromDate);
        if (toDate) params.set('to', toDate);

        const res = await fetch(`/api/organizer/insights?${params.toString()}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to load insights');
        }

        setPayload(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load insights');
      } finally {
        setLoading(false);
      }
    };

    loadInsights();
  }, [selectedEventId, fromDate, toDate]);

  const ticketTypeBars = useMemo(
    () =>
      (payload?.byTicketType || []).map((row) => ({
        label: row.type,
        sold: row.count,
      })),
    [payload]
  );

  const paymentMethodBars = useMemo(
    () =>
      (payload?.paymentMethodBreakdown || []).map((row) => ({
        label: row.method,
        revenue: Number(row.revenue.toFixed(2)),
      })),
    [payload]
  );

  const quickDetails = useMemo(
    () => [
      { label: 'Paid vs Pending Orders', detail: `${payload?.summary.paidOrders || 0} / ${payload?.summary.pendingOrders || 0}` },
      { label: 'Total Tickets Issued', detail: `${payload?.summary.totalTicketsIssued || 0}` },
      { label: 'Total Tickets Checked In', detail: `${payload?.summary.totalTicketsCheckedIn || 0}` },
      { label: 'Unique Buyers', detail: `${payload?.summary.uniqueBuyers || 0}` },
    ],
    [payload]
  );

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <section className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Organizer Workspace</p>
            <h1 className="text-4xl font-bold tracking-tight">Insights</h1>
            <p className="text-slate-600 mt-2">Customize analytics by event and date range.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/organizer" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">
              Back to Command Center
            </Link>
            <Link href="/my-events" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">
              Manage Events
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Event</label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="all">All My Events</option>
              {(payload?.events || []).map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setSelectedEventId('all');
                setFromDate('');
                setToDate('');
              }}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Reset Filters
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-800 mb-3">Customize visible analytics</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            {Object.keys(defaultWidgets).map((rawKey) => {
              const key = rawKey as WidgetKey;
              return (
                <label key={key} className="inline-flex items-center gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    checked={widgets[key]}
                    onChange={(e) => setWidgets((prev) => ({ ...prev, [key]: e.target.checked }))}
                  />
                  <span>{key}</span>
                </label>
              );
            })}
          </div>
        </div>

        {loading && <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">Loading insights…</div>}
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}

        {!loading && !error && payload && (
          <>
            {widgets.summary && (
              <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Revenue</p><p className="text-2xl font-bold">{formatMoney(payload.summary.totalRevenue)}</p></div>
                <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Orders</p><p className="text-2xl font-bold">{payload.summary.totalOrders}</p></div>
                <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Avg Order</p><p className="text-2xl font-bold">{formatMoney(payload.summary.averageOrderValue)}</p></div>
                <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Check-in Rate</p><p className="text-2xl font-bold">{payload.summary.checkInRatePct.toFixed(1)}%</p></div>
                <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Unique Buyers</p><p className="text-2xl font-bold">{payload.summary.uniqueBuyers}</p></div>
                <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Tickets Issued</p><p className="text-2xl font-bold">{payload.summary.totalTicketsIssued}</p></div>
                <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Tickets Checked In</p><p className="text-2xl font-bold">{payload.summary.totalTicketsCheckedIn}</p></div>
                <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Published / Draft</p><p className="text-2xl font-bold">{payload.summary.publishedEvents} / {payload.summary.draftEvents}</p></div>
              </section>
            )}

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {widgets.events && (
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <h2 className="text-lg font-semibold mb-3">Performance by Event</h2>
                  <div className="space-y-3 max-h-96 overflow-auto pr-1">
                    {payload.byEvent.map((row) => (
                      <div key={row.eventId} className="rounded-lg border border-slate-200 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-slate-900">{row.title}</p>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${row.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{row.status}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{formatDate(row.startDate)}</p>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700">
                          <div>Orders: <strong>{row.orders}</strong></div>
                          <div>Revenue: <strong>{formatMoney(row.revenue)}</strong></div>
                          <div>Tickets: <strong>{row.ticketsIssued}</strong></div>
                          <div>Check-ins: <strong>{row.ticketsCheckedIn}</strong></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {widgets.ticketTypes && (
                <RechartsCategoryBarCard
                  title="Ticket Type Mix"
                  data={ticketTypeBars}
                  xKey="label"
                  yKey="sold"
                  barColor="#6366f1"
                  valueFormatter={(v) => `${v} sold`}
                />
              )}

              {widgets.hourlyPurchases && (
                <RechartsBarCard
                  title="Purchases by Hour"
                  data={payload.purchasesByHour.map((row) => ({
                    hour: `${String(row.hour).padStart(2, '0')}:00`,
                    orders: row.count,
                  }))}
                  xKey="hour"
                  yKey="orders"
                  barColor="#3b82f6"
                />
              )}

              {widgets.hourlyCheckins && (
                <RechartsBarCard
                  title="Check-ins by Hour"
                  data={payload.checkinsByHour.map((row) => ({
                    hour: `${String(row.hour).padStart(2, '0')}:00`,
                    checkins: row.count,
                  }))}
                  xKey="hour"
                  yKey="checkins"
                  barColor="#10b981"
                />
              )}

              {widgets.dailyTrend && (
                <RechartsBarCard
                  title="Daily Revenue Trend"
                  data={payload.purchasesByDay.map((row) => ({
                    day: formatDate(row.day),
                    revenue: Number(row.revenue.toFixed(2)),
                  }))}
                  xKey="day"
                  yKey="revenue"
                  barColor="#8b5cf6"
                  yTickFormatter={(v) => `€${Math.round(v)}`}
                  tooltipFormatter={(v) => formatMoney(v)}
                />
              )}

              {widgets.paymentMethods && (
                <RechartsCategoryBarCard
                  title="Payment Method Breakdown"
                  data={paymentMethodBars}
                  xKey="label"
                  yKey="revenue"
                  barColor="#06b6d4"
                  valueFormatter={(v) => formatMoney(v)}
                />
              )}

              {!widgets.ticketTypes && !widgets.paymentMethods && !widgets.hourlyPurchases && !widgets.hourlyCheckins && !widgets.dailyTrend && (
                <CompactMetricList rows={quickDetails} />
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}
