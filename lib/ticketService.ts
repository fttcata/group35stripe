import QRCode from 'qrcode';
import { supabase } from './supabaseClient';

export interface Ticket {
  id: string;
  ticket_code: string;
  qr_code_data: string;
  ticket_type: string;
  is_used: boolean;
  check_in_code?: string;
}

/**
 * Generates a unique 6-digit numeric ticket code.
 */
function generateTicketCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generates a unique check-in code
 */
function generateCheckInCode(): string {
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CHK-${timestamp}-${randomPart}`;
}

/**
 * Generates a QR code as a data URL containing ticket information
 */
async function generateQRCode(ticketCode: string, eventTitle: string): Promise<string> {
  try {
    const qrData = `${ticketCode}|${eventTitle}|${new Date().toISOString()}`;
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
    return qrCodeDataUrl;
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    throw new Error('QR code generation failed');
  }
}

/**
 * Creates tickets for an order in the database.
 * All tickets in the order share a single QR code (the first ticket's code)
 * so that scanning one QR reveals the entire order.
 */
export async function createTickets(
  orderId: string,
  eventTitle: string,
  ticketType: string,
  quantity: number
): Promise<Ticket[]> {
  const tickets: Ticket[] = [];

  // Generate the primary ticket code + QR that represents this order
  const primaryCode = generateTicketCode();
  const sharedQrCode = await generateQRCode(primaryCode, eventTitle);

  for (let i = 0; i < quantity; i++) {
    const ticketCode = i === 0 ? primaryCode : generateTicketCode();

    tickets.push({
      id: crypto.randomUUID(),
      ticket_code: ticketCode,
      check_in_code: ticketCode, // same 6-digit code serves both purposes
      qr_code_data: sharedQrCode, // all tickets share the primary QR
      ticket_type: ticketType,
      is_used: false,
    });
  }

  // Insert all tickets into the database
  if (supabase) {
    const ticketsWithOrderId = tickets.map(ticket => ({
      ...ticket,
      order_id: orderId,
    }));

    const { error } = await supabase
      .from('tickets')
      .insert(ticketsWithOrderId);

    if (error) {
      console.error('Failed to insert tickets:', error);
      throw new Error('Failed to create tickets in database');
    }
  }

  return tickets;
}

async function backfillCheckInCodes(tickets: Ticket[]): Promise<Ticket[]> {
  if (!supabase) return tickets;

  const needsCode = tickets.filter(t => !t.check_in_code);
  if (needsCode.length === 0) return tickets;

  const updated: Ticket[] = [...tickets];
  for (const ticket of needsCode) {
    const code = generateTicketCode();
    const { error } = await supabase
      .from('tickets')
      .update({ check_in_code: code })
      .eq('id', ticket.id);

    if (!error) {
      const idx = updated.findIndex(t => t.id === ticket.id);
      if (idx !== -1) updated[idx] = { ...updated[idx], check_in_code: code };
    } else {
      console.error(`Failed to backfill check_in_code for ticket ${ticket.id}:`, error);
    }
  }
  return updated;
}

/**
 * Retrieves tickets for an order
 */
export async function getTicketsByOrderId(orderId: string): Promise<Ticket[]> {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('order_id', orderId);

  if (error) {
    console.error('Failed to fetch tickets:', error);
    throw new Error('Failed to retrieve tickets');
  }

  return backfillCheckInCodes(data || []);
}

/**
 * Marks a ticket as used
 */
export async function markTicketAsUsed(ticketId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { error } = await supabase
    .from('tickets')
    .update({
      is_used: true,
      used_at: new Date().toISOString(),
    })
    .eq('id', ticketId);

  if (error) {
    console.error('Failed to mark ticket as used:', error);
    throw new Error('Failed to update ticket status');
  }
}
