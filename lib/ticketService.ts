import QRCode from 'qrcode';
import { supabase } from './supabaseClient';

export interface Ticket {
  id: string;
  ticket_code: string;
  qr_code_data: string;
  ticket_type: string;
  is_used: boolean;
}

/**
 * Generates a unique ticket code
 */
function generateTicketCode(): string {
  // Format: TICKET-YYYYMMDD-XXXXXX (e.g., TICKET-20260211-AB12CD)
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TICKET-${timestamp}-${randomPart}`;
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
 * Creates tickets for an order in the database
 */
export async function createTickets(
  orderId: string,
  eventTitle: string,
  ticketType: string,
  quantity: number
): Promise<Ticket[]> {
  const tickets: Ticket[] = [];

  for (let i = 0; i < quantity; i++) {
    const ticketCode = generateTicketCode();
    const qrCodeData = await generateQRCode(ticketCode, eventTitle);

    tickets.push({
      id: crypto.randomUUID(),
      ticket_code: ticketCode,
      qr_code_data: qrCodeData,
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

  return data || [];
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
