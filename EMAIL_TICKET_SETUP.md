# Email Ticket Delivery Implementation Guide

## Overview

This implementation adds automatic email ticket delivery with QR codes for the ticketing system. When a customer purchases tickets via Stripe, they automatically receive a confirmation email with:

- Event details
- Individual ticket codes and QR codes
- Payment confirmation or payment reminder
- Next steps for the event day

## Features Implemented

### 1. **Automatic Email Sending on Payment**
- Listens to Stripe webhook events (`checkout.session.completed`)
- Automatically generates and sends confirmation emails
- Includes QR codes for ticket scanning at entry
- Embeds payment confirmation or payment reminder based on payment method

### 2. **QR Code Generation**
- Generates unique QR codes for each ticket
- QR codes contain ticket code, event title, and generation timestamp
- Embedded directly in email as base64 data URLs
- High-resolution (300x300 pixels) for reliable scanning

### 3. **Ticket Management**
- Stores tickets in database with unique codes
- Tracks ticket usage (used/unused)
- Associates tickets with orders and events
- Allows users to retrieve tickets by email or order ID

### 4. **Email Templates**
- Professional HTML email design with gradient header
- Responsive and mobile-friendly
- Clear event information presentation
- Payment status indication with visual cues
- Instructions for event day

## Setup Instructions

### Prerequisites

1. **Resend Account**: Sign up at [resend.com](https://resend.com)
2. **Stripe Account**: Already configured
3. **Supabase Database**: Already set up with the updated schema

### Environment Variables

Add these to your `.env.local` file:

```bash
# Resend Email Service
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com  # Should be a Domain

# Stripe Webhook
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx

# Base URL for success/cancel redirects
NEXT_PUBLIC_BASE_URL=http://localhost:3000  # Update for production
```

### Getting Your API Keys

#### Resend API Key
1. Go to [resend.com](https://resend.com)
2. Navigate to API Keys
3. Create a new API key
4. Copy to `RESEND_API_KEY`

#### Stripe Webhook Secret
1. Go to Stripe Dashboard > Developers > Webhooks
2. Create a new endpoint:
   - URL: `https://yourdomain.com/api/webhooks/stripe`
   - Events: Select `checkout.session.completed` and `payment_intent.succeeded`
3. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`

#### Resend From Email
- For development: Use Resend's default `onboarding@resend.dev`
- For production: Configure a verified domain in Resend

### Database Schema Update

The schema has been updated with:

```sql
-- Updated orders table
ALTER TABLE orders ADD COLUMN customer_email text;
ALTER TABLE orders ADD COLUMN payment_method text DEFAULT 'stripe';
ALTER TABLE orders ADD COLUMN stripe_session_id text UNIQUE;

-- New tickets table
CREATE TABLE tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  ticket_code text UNIQUE NOT NULL,
  qr_code_data text NOT NULL,
  ticket_type text NOT NULL,
  is_used boolean DEFAULT false,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

Run the updated `db/schema.sql` file in your Supabase database.

## API Endpoints

### POST /api/checkout
**Updated to include email and payment method**

Request:
```json
{
  "eventName": "Dublin City Marathon",
  "eventDate": "2026-02-10",
  "totalPrice": 4500,
  "quantity": 1,
  "eventId": "event-uuid",
  "customerEmail": "customer@example.com",
  "paymentMethod": "stripe"
}
```

### POST /api/webhooks/stripe
**Webhook endpoint for Stripe events**

Automatically processes:
- `checkout.session.completed`: Creates order, generates tickets, sends email
- `payment_intent.succeeded`: Updates payment status

### POST /api/tickets
**Retrieve tickets by email or order ID**

Request:
```json
{
  "email": "customer@example.com",
  "orderId": "order-uuid"
}
```

Response:
```json
{
  "orderId": "order-uuid",
  "event": {
    "title": "Dublin City Marathon",
    "date": "2026-02-10",
    "venue": "Downtown Starting Line"
  },
  "tickets": [
    {
      "ticket_code": "TICKET-20260211-ABCD12",
      "ticket_type": "Standard",
      "qr_code_data": "data:image/png;base64,..."
    }
  ],
  "paymentStatus": "completed",
  "totalAmount": 45.00
}
```

## Pages and Components

### `/tickets` - My Tickets Page
Users can retrieve and view their tickets:
- Search by email or order ID
- View all ticket details
- Download/print QR codes
- See event information

### Updated `/success` - Success Page
Displays order confirmation with:
- Confirmation message
- Session ID
- Note about email being sent

## File Structure

```
lib/
  ├── ticketService.ts          # Ticket generation and management
  ├── emailService.ts           # Email composition and sending
  └── supabaseClient.ts         # Database client

app/
  ├── api/
  │   ├── checkout/
  │   │   └── route.ts         # Updated checkout endpoint
  │   ├── tickets/
  │   │   └── route.ts         # Ticket retrieval API
  │   └── webhooks/
  │       └── stripe/
  │           └── route.ts     # Stripe webhook handler
  ├── tickets/
  │   └── page.tsx             # My Tickets page
  └── success/
      └── page.tsx             # Updated success page

db/
  └── schema.sql               # Updated with tickets table
```

## Testing

### Local Testing with Stripe CLI

1. **Install Stripe CLI**
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe
   
   # Windows
   choco install stripe
   ```

2. **Forward webhook events**
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

3. **Get your webhook signing secret**
   The CLI will display: `whsec_test_xxxxx`
   Add to `.env.local` as `STRIPE_WEBHOOK_SECRET`

4. **Test checkout completion**
   ```bash
   stripe trigger checkout.session.completed
   ```

### Manual Testing

1. Set up environment variables
2. Run the development server: `npm run dev`
3. Complete a checkout at `http://localhost:3000/buy`
4. Use Stripe test card: `4242 4242 4242 4242`
5. Check email (check spam folder) for confirmation
6. Visit `/tickets` to retrieve tickets

### Test Email Addresses

With Resend in development mode, you can send to:
- Your own registered email
- Any email that successfully receives the confirmation

## Troubleshooting

### Emails Not Sending

1. **Check API Key**: Ensure `RESEND_API_KEY` is set correctly
2. **Check From Address**: Use `onboarding@resend.dev` for testing
3. **Check Logs**: Look at server console for errors
4. **Webhook Status**: Verify webhook is receiving events from Stripe

### Webhook Not Triggering

1. **Verify Secret**: Ensure `STRIPE_WEBHOOK_SECRET` matches your endpoint
2. **Check URL**: Webhook should be reachable from internet (not localhost in production)
3. **Test with CLI**: Use `stripe trigger` to test locally
4. **Logs**: Check Stripe dashboard > Logs > Webhook endpoints

### QR Code Issues

1. **Generation Failed**: Check server console for QR generation errors
2. **Not Displaying**: Verify `qr_code_data` is saved correctly in database
3. **Poor Quality**: Current resolution (300x300) should be sufficient

## Production Deployment

### Resend Configuration

1. Add your domain to Resend
2. Verify DNS records (DKIM, SPF, DMARC)
3. Update `RESEND_FROM_EMAIL` to use your domain
4. Monitor email deliverability

### Stripe Setup

1. Update webhook URL to production endpoint
2. Set `STRIPE_WEBHOOK_SECRET` to production secret
3. Test webhook delivery in Stripe dashboard
4. Monitor webhook logs for errors

### Environment

```bash
# Production .env.local
STRIPE_SECRET_KEY=sk_live_xxxxx
RESEND_API_KEY=re_xxxxx  # Production key
RESEND_FROM_EMAIL=noreply@yourdomain.com
STRIPE_WEBHOOK_SECRET=whsec_xxxxx  # Production secret
NEXT_PUBLIC_BASE_URL=https://tickets.yourdomain.com
```

### Database

- Ensure `tickets` table is created
- Verify `orders` table has new columns
- Set up regular backups
- Monitor database performance

## Email Customization

### Modify Email Template

Edit `/lib/emailService.ts`, function `generateEmailHTML()`:

```typescript
// Change colors
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

// Change logo/header
<h1>🎫 Your Event Tickets</h1>

// Modify content sections
```

### Branding

1. Update logo in email header
2. Change colors to match brand
3. Add company footer/contact info
4. Customize reply-to address

## Future Enhancements

1. **SMS Reminders**: Add day-before event reminders via SMS
2. **Resend Status**: Track email delivery and opens
3. **Ticket Transfer**: Allow users to forward tickets to others
4. **Group Tickets**: Consolidate multiple tickets in one email
5. **PDF Tickets**: Generate PDF format for printing
6. **Check-in System**: Integrate QR code scanning for entry

## Support

For issues with:
- **Resend**: Check [resend.com docs](https://resend.com/docs)
- **Stripe**: Check [stripe.com docs](https://stripe.com/docs)
- **Supabase**: Check [supabase.com docs](https://supabase.com/docs)

## Summary of Changes Made

✅ Installed `resend` and `qrcode` packages
✅ Created ticket generation service with QR codes
✅ Created email service with professional templates
✅ Created Stripe webhook handler
✅ Updated checkout endpoint for email capture
✅ Created ticket retrieval API
✅ Created My Tickets page for users
✅ Updated database schema with tickets table
✅ Comprehensive documentation

The system is ready for testing! Start by setting up your environment variables and running a test checkout.
