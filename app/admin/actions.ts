'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { supabase as adminSupabase } from '@/lib/supabaseClient'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

type EventRow = {
  id: string
  title?: string | null
  date?: string | null
  start_date?: string | null
}

type OrderRow = {
  id: string
  total_amount?: number | string | null
  payment_status?: string | null
  payment_method?: string | null
  created_at?: string | null
  customer_email?: string | null
  guest_name?: string | null
  guest_email?: string | null
  guest_phone?: string | null
  stripe_session_id?: string | null
}

type OrderItemRow = {
  order_id: string
  quantity?: number | null
  ticket_types?: { name?: string | null } | null
}

export type DeleteEventResult = {
  receiptsCsv: string | null
  receiptsFilename: string | null
  archivedOrders: number
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = String(value).replace(/"/g, '""')
  if (/[",\n\r]/.test(text)) {
    return `"${text}"`
  }
  return text
}

function buildReceiptsFilename(eventTitle?: string | null): string {
  const safeTitle = (eventTitle || 'event')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'event'
  const stamp = new Date().toISOString().slice(0, 10)
  return `${safeTitle}-receipts-${stamp}.csv`
}

function buildReceiptsCsv(event: EventRow, orders: OrderRow[], orderItems: OrderItemRow[]): string {
  const eventDate = event.start_date || event.date || ''
  const deletedAt = new Date().toISOString()

  const ticketsByOrder = new Map<string, Map<string, number>>()
  orderItems.forEach((item) => {
    const orderId = item.order_id
    if (!orderId) return

    const name = item.ticket_types?.name || 'Unknown ticket'
    const quantity = Number(item.quantity || 0)
    if (!ticketsByOrder.has(orderId)) {
      ticketsByOrder.set(orderId, new Map<string, number>())
    }

    const lineItems = ticketsByOrder.get(orderId)!
    lineItems.set(name, (lineItems.get(name) || 0) + quantity)
  })

  const headers = [
    'event_id',
    'event_title',
    'event_date',
    'deleted_at_utc',
    'order_id',
    'purchased_at',
    'payment_status',
    'payment_method',
    'total_amount',
    'buyer_name',
    'buyer_email',
    'buyer_phone',
    'stripe_session_id',
    'ticket_summary',
    'ticket_count'
  ]

  const rows = orders.map((order) => {
    const ticketLines = ticketsByOrder.get(order.id)
    const ticketSummary = ticketLines
      ? [...ticketLines.entries()].map(([name, quantity]) => `${name} x${quantity}`).join(' | ')
      : ''
    const ticketCount = ticketLines
      ? [...ticketLines.values()].reduce((sum, quantity) => sum + quantity, 0)
      : 0
    const buyerEmail = order.customer_email || order.guest_email || ''

    return [
      event.id,
      event.title || '',
      eventDate,
      deletedAt,
      order.id,
      order.created_at || '',
      order.payment_status || '',
      order.payment_method || '',
      order.total_amount || 0,
      order.guest_name || '',
      buyerEmail,
      order.guest_phone || '',
      order.stripe_session_id || '',
      ticketSummary,
      ticketCount
    ]
      .map(escapeCsv)
      .join(',')
  })

  return [headers.map(escapeCsv).join(','), ...rows].join('\n')
}

async function checkAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== 'admin@group35.com') {
    throw new Error('Unauthorized - Admin only')
  }
}

export async function updateAccount(id: string, formData: FormData) {
  await checkAdmin()

  const full_name = formData.get('full_name') as string
  const role = formData.get('role') as string

  if (!full_name || !role) {
    throw new Error('Missing required fields')
  }

  // Update public profiles table
  const { error } = await adminSupabase!
    .from('profiles')
    .update({ full_name, role })
    .eq('id', id)

  if (error) {
    console.error('Error updating account profile:', error)
    throw new Error('Failed to update account')
  }

  // CRITICAL: We also need to update auth.users metadata because Middlewares and Pages check user_metadata.role
  const { error: authError } = await adminSupabase!.auth.admin.updateUserById(id, {
    user_metadata: { role, full_name }
  })

  if (authError) {
    console.error('Error updating auth user metadata:', authError)
    throw new Error('Failed to update auth permissions')
  }

  revalidatePath('/admin')
  // Go back to the correct tab in dashboard
  redirect(`/admin?tab=${role === 'organizer' ? 'organizers' : 'attendees'}`)
}

export async function deleteEvent(id: string): Promise<DeleteEventResult> {
  await checkAdmin()

  const { data: event, error: eventError } = await adminSupabase!
    .from('events')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (eventError) {
    console.error('Error loading event before deletion:', eventError)
    throw new Error('Unable to load event before deletion')
  }

  if (!event) {
    throw new Error('Event not found or already deleted')
  }

  const typedEvent = event as EventRow

  const { data: orders, error: ordersError } = await adminSupabase!
    .from('orders')
    .select('*')
    .eq('event_id', id)
    .order('created_at', { ascending: true })

  if (ordersError) {
    console.error('Error fetching event orders for export:', ordersError)
    throw new Error('Unable to retrieve event receipts before deletion')
  }

  const typedOrders = (orders || []) as OrderRow[]
  const orderIds = typedOrders.map((order) => order.id)

  let typedOrderItems: OrderItemRow[] = []
  if (orderIds.length > 0) {
    const { data: orderItems, error: orderItemsError } = await adminSupabase!
      .from('order_items')
      .select('order_id,quantity,ticket_types(name)')
      .in('order_id', orderIds)

    if (orderItemsError) {
      console.error('Error fetching order items for export:', orderItemsError)
      throw new Error('Unable to retrieve ticket lines before deletion')
    }

    typedOrderItems = (orderItems || []) as unknown as OrderItemRow[]
  }

  const receiptsCsv = typedOrders.length > 0
    ? buildReceiptsCsv(typedEvent, typedOrders, typedOrderItems)
    : null
  const receiptsFilename = typedOrders.length > 0
    ? buildReceiptsFilename(typedEvent.title)
    : null

  if (orderIds.length > 0) {
    const { error: deleteOrdersError } = await adminSupabase!
      .from('orders')
      .delete()
      .eq('event_id', id)

    if (deleteOrdersError) {
      console.error('Error deleting event orders:', deleteOrdersError)
      throw new Error('Failed to remove ticket purchases before deleting the event')
    }
  }

  const { error } = await adminSupabase!.from('events').delete().eq('id', id)

  if (error) {
    console.error('Error deleting event:', error)
    if (error.code === '23503') {
      throw new Error('Event cannot be deleted because related records still exist.')
    }
    throw new Error(error.message || 'Failed to delete event')
  }

  revalidatePath('/admin')

  return {
    receiptsCsv,
    receiptsFilename,
    archivedOrders: typedOrders.length
  }
}

export async function deleteAccount(id: string) {
  await checkAdmin()

  // Deleting from auth.users might require special admin API functions
  // but deleting from profiles might cascade, or we can just delete from profiles.
  // Actually, better to use the admin auth api:
  const { error } = await adminSupabase!.auth.admin.deleteUser(id)

  if (error) {
    console.error('Error deleting account:', error)
    throw new Error('Failed to delete account')
  }

  revalidatePath('/admin')
  redirect('/admin')
}
