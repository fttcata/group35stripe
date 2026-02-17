import nodemailer from 'nodemailer';
import { Ticket } from './ticketService';

const smtpHost = process.env.BREVO_SMTP_HOST || process.env.SMTP_HOST || '';
const smtpPort = Number(process.env.BREVO_SMTP_PORT || process.env.SMTP_PORT || 587);
const smtpUser = process.env.BREVO_SMTP_USER || process.env.SMTP_USER || '';
const smtpPass = process.env.BREVO_SMTP_PASS || process.env.SMTP_PASS || '';
const fromEmail =
  process.env.BREVO_FROM_EMAIL ||
  process.env.RESEND_FROM_EMAIL ||
  process.env.SMTP_FROM_EMAIL ||
  'noreply@eventtickets.com';
const replyToEmail = process.env.SUPPORT_EMAIL || 'support@eventtickets.com';

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

export interface TicketEmailData {
  customer_email: string;
  customer_name?: string;
  event_title: string;
  event_date: string;
  event_venue?: string;
  event_description?: string;
  tickets: Ticket[];
  total_amount: number;
  payment_method: string;
  order_id: string;
}

/**
 * Converts base64 data URL to Buffer for email attachments
 */
function dataUrlToBuffer(dataUrl: string): Buffer {
  const base64Data = dataUrl.split(',')[1] || dataUrl;
  return Buffer.from(base64Data, 'base64');
}

/**
 * Safely formats event dates for email rendering.
 */
function formatEventDate(dateInput: string, options?: Intl.DateTimeFormatOptions): string {
  const parsed = new Date(dateInput);
  if (Number.isNaN(parsed.getTime())) {
    return 'To be announced';
  }

  return parsed.toLocaleDateString('en-US', options);
}

/**
 * Generates HTML email content for ticket confirmation
 */
function generateEmailHTML(data: TicketEmailData, ticketImageUrls: string[] = []): string {
  const paymentReminder = data.payment_method === 'pay-on-day'
    ? `<div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0;">
        <p style="margin: 0; color: #92400e; font-weight: 500;">
          💳 Payment Reminder
        </p>
        <p style="margin: 8px 0 0 0; color: #78350f; font-size: 14px;">
          Please complete your payment of $${data.total_amount.toFixed(2)} at the venue on event day.
        </p>
      </div>`
    : `<div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0;">
        <p style="margin: 0; color: #065f46; font-weight: 500;">
          ✓ Payment Confirmed
        </p>
        <p style="margin: 8px 0 0 0; color: #047857; font-size: 14px;">
          You have paid $${data.total_amount.toFixed(2)} for this event.
        </p>
      </div>`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f9fafb;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 8px 8px 0 0;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
        }
        .content {
          background-color: white;
          padding: 30px;
          border-radius: 0 0 8px 8px;
        }
        .event-info {
          background-color: #f3f4f6;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }
        .event-detail {
          margin: 10px 0;
        }
        .event-detail strong {
          display: inline-block;
          width: 120px;
          color: #667eea;
        }
        .tickets-section {
          margin: 30px 0;
        }
        .ticket-card {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 20px;
          margin: 15px 0;
          background-color: #fafbfc;
        }
        .ticket-code {
          font-family: 'Courier New', monospace;
          font-size: 16px;
          font-weight: bold;
          color: #667eea;
          margin: 10px 0;
        }
        .qr-code {
          text-align: center;
          margin: 15px 0;
        }
        .qr-code img {
          max-width: 200px;
          height: auto;
          border: 1px solid #e5e7eb;
          padding: 10px;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #6b7280;
          text-align: center;
        }
        .button {
          display: inline-block;
          background-color: #667eea;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 6px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎫 Your Event Tickets</h1>
          <p style="margin: 10px 0 0 0;">Order Confirmed</p>
        </div>
        
        <div class="content">
          <p>Hello${data.customer_name ? ` ${data.customer_name}` : ''}!</p>
          
          <p>Thank you for your purchase. Your tickets for <strong>${data.event_title}</strong> are ready!</p>
          
          <div class="event-info">
            <div class="event-detail">
              <strong>Event:</strong> ${data.event_title}
            </div>
            <div class="event-detail">
              <strong>Date:</strong> ${formatEventDate(data.event_date, { 
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
            ${data.event_venue ? `<div class="event-detail">
              <strong>Venue:</strong> ${data.event_venue}
            </div>` : ''}
            ${data.event_description ? `<div class="event-detail">
              <strong>Description:</strong> ${data.event_description}
            </div>` : ''}
          </div>
          
          ${paymentReminder}
          
          <div class="tickets-section">
            <h2 style="color: #667eea; margin-bottom: 20px;">Your Tickets (${data.tickets.length})</h2>
            ${data.tickets.map((ticket, index) => `
              <div class="ticket-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                  <h3 style="margin: 0; color: #333;">Ticket ${index + 1}</h3>
                  <span style="background-color: #667eea; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px;">${ticket.ticket_type}</span>
                </div>
                <div class="ticket-code">
                  ${ticket.ticket_code}
                </div>
                <div class="qr-code">
                  <p style="margin: 10px 0; font-size: 12px; color: #6b7280;">Scan at entry</p>
                  <img src="${ticketImageUrls[index] || ticket.qr_code_data || 'cid:qr_code_' + index}" alt="QR Code for Ticket ${index + 1}">
                </div>
              </div>
            `).join('')}
          </div>
          
          <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #667eea;">📋 What's Next?</h3>
            <ul style="padding-left: 20px; margin: 10px 0;">
              <li>Save these tickets or screenshot them for your records</li>
              <li>Bring your ticket (screenshot or printed) to the event</li>
              <li>Arrive 15 minutes early for smooth check-in</li>
              <li>Have a great time! 🎉</li>
            </ul>
          </div>
          
          <div class="footer">
            <p>Order ID: ${data.order_id}</p>
            <p>If you have any questions, please contact our support team.</p>
            <p>&copy; 2026 Event Ticketing System. All rights reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Sends ticket confirmation email using SMTP (Brevo-compatible)
 */
export async function sendTicketConfirmationEmail(
  data: TicketEmailData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (!smtpHost || !smtpUser || !smtpPass) {
      throw new Error('SMTP credentials are not configured');
    }

    // Send QR codes as inline CID attachments so major email clients render them reliably.
    const qrAttachments = data.tickets.map((ticket, index) => ({
      filename: `ticket-${index + 1}.png`,
      content: dataUrlToBuffer(ticket.qr_code_data),
      cid: `qr_code_${index}`,
    }));
    const ticketImageUrls = data.tickets.map((_, index) => `cid:qr_code_${index}`);

    const result = await transporter.sendMail({
      from: fromEmail,
      to: data.customer_email,
      subject: `Your Tickets for ${data.event_title} - Order ${data.order_id}`,
      html: generateEmailHTML(data, ticketImageUrls),
      attachments: qrAttachments,
      replyTo: replyToEmail,
    });

    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (error) {
    console.error('Failed to send ticket confirmation email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Sends a payment reminder email for "Pay On Day" orders
 */
export async function sendPaymentReminderEmail(
  email: string,
  eventTitle: string,
  eventDate: string,
  amount: number,
  orderId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (!smtpHost || !smtpUser || !smtpPass) {
      throw new Error('SMTP credentials are not configured');
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #f59e0b;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💳 Payment Reminder</h1>
          </div>
          <div style="background-color: #fff; padding: 20px; text-align: center;">
            <p>This is a reminder to complete your payment for <strong>${eventTitle}</strong></p>
            <p style="font-size: 24px; color: #f59e0b; margin: 20px 0;"><strong>$${amount.toFixed(2)}</strong></p>
            <p>Event Date: <strong>${formatEventDate(eventDate)}</strong></p>
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              Please bring payment to the event venue on the day of the event. Your order ID is: <code>${orderId}</code>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await transporter.sendMail({
      from: fromEmail,
      to: email,
      subject: `Payment Reminder: ${eventTitle} - Order ${orderId}`,
      html,
      replyTo: replyToEmail,
    });

    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (error) {
    console.error('Failed to send payment reminder email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
