# Stripe Checkout Integration - Implementation Guide

## Overview
This document describes the implementation of Stripe Checkout integration for the ticket purchasing system (PB11). The implementation allows attendees to purchase tickets online and receive immediate confirmation.

## Features Implemented

### 1. **Checkout API Route** (`/app/api/checkout/route.ts`)
- Creates Stripe Checkout Sessions with event details
- Accepts customizable parameters:
  - `eventName`: Name of the event
  - `eventDate`: Date of the event
  - `totalPrice`: Price in cents (e.g., 1000 = $10.00)
  - `quantity`: Number of tickets
- Returns checkout URL for redirect to Stripe's hosted page
- Stores session ID for order tracking (TODO: integrate with database)
- Includes comprehensive error handling

### 2. **Ticket Purchase Page** (`/app/buy/page.tsx`)
- Displays ticket details (event name, date, price)
- Shows order summary before checkout
- Handles loading states during payment processing
- Displays error messages if checkout fails
- Redirects to Stripe hosted checkout page on submit

### 3. **Success Page** (`/app/success/page.tsx`)
- Displays payment confirmation
- Shows Stripe session ID for order reference
- Provides order details confirmation
- Links to return home or purchase additional tickets
- Includes placeholder for fetching full session details from backend

### 4. **Cancel Page** (`/app/cancel/page.tsx`)
- Informs user that payment was cancelled
- Confirms no charges were made
- Allows user to return to checkout to retry
- Provides navigation options

### 5. **Home Page Updates** (`/app/page.tsx`)
- Displays success notification if redirected from success page
- Displays cancellation notification if redirected from cancel page
- Main entry point for the ticket store

## Setup Instructions

### 1. Environment Variables
Create a `.env.local` file with the following variables:

```env
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

Get your keys from: https://dashboard.stripe.com/apikeys

### 2. Install Dependencies
The required packages are already installed:
- `stripe` (v20.2.0) - Backend SDK
- `@stripe/stripe-js` (v8.6.4) - Frontend library

### 3. Run the Development Server
```bash
npm run dev
```

Visit `http://localhost:3000` to test the implementation.

## User Flow

1. **Browse Tickets** → User visits home page
2. **Go to Checkout** → Clicks "Go to Buy Page"
3. **Review Order** → Views ticket details and total price
4. **Initiate Payment** → Clicks "Confirm & Pay" button
5. **Redirect to Stripe** → Redirected to Stripe's hosted checkout
6. **Enter Payment Details** → User enters card information (test cards below)
7. **Success/Cancel** → Redirected to success or cancel page based on payment result

## Testing with Stripe Test Cards

Use these test cards to test the payment flow:

### Successful Payment
- Card Number: `4242 4242 4242 4242`
- Exp: Any future date (e.g., 12/25)
- CVC: Any 3 digits (e.g., 123)

### Payment Declined
- Card Number: `4000 0000 0000 0002`
- Exp: Any future date
- CVC: Any 3 digits

### More test cards available at:
https://stripe.com/docs/testing

## API Endpoints

### POST `/api/checkout`
Creates a checkout session and returns the Stripe checkout URL.

**Request Body:**
```json
{
  "eventName": "Summer Music Festival",
  "eventDate": "June 15, 2024",
  "totalPrice": 1000,
  "quantity": 1
}
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/...",
  "sessionId": "cs_test_..."
}
```

**Error Response:**
```json
{
  "error": "Error message"
}
```

## Database Integration (TODO)

The API route includes a placeholder for storing checkout sessions in a database:

```typescript
// TODO: Store session ID in database with user/order information
// Example: await saveCheckoutSession({
//   stripeSessionId: session.id,
//   eventName,
//   eventDate,
//   quantity,
//   totalPrice,
//   timestamp: new Date(),
// });
```

To complete this feature, implement a database query to store:
- Stripe Session ID (primary reference)
- Event details
- Quantity
- Total price
- Timestamp
- User ID (when user authentication is added)

## Webhook Setup (Advanced)

For production, implement Stripe webhooks to:
1. Track completed payments
2. Send confirmation emails
3. Update order status in database
4. Handle refunds and disputes

Webhook configuration in Stripe Dashboard:
- Endpoint: `https://yourdomain.com/api/webhooks/stripe`
- Events: `checkout.session.completed`, `charge.refunded`, etc.

## File Structure
```
app/
├── api/
│   └── checkout/
│       └── route.ts          # Stripe session creation
├── buy/
│   └── page.tsx              # Checkout page
├── success/
│   └── page.tsx              # Success confirmation (NEW)
├── cancel/
│   └── page.tsx              # Cancellation handling (NEW)
├── page.tsx                  # Home page (UPDATED)
├── layout.tsx                # Layout component
└── globals.css               # Global styles
.env.example                  # Environment variables template (NEW)
```

## Next Steps

1. **Database Integration**: Connect to Supabase to store order information
2. **User Authentication**: Integrate NextAuth.js for user accounts
3. **Email Notifications**: Send confirmation emails via SendGrid or similar
4. **Webhook Implementation**: Handle Stripe events for real-time updates
5. **Event Management**: Create dynamic event selection (currently hardcoded)
6. **Inventory Management**: Track available ticket quantities
7. **Check-in System**: Implement QR code scanning for event check-in
8. **Refund Handling**: Allow ticket refunds and transfers

## Troubleshooting

### Stripe API Key Issues
- Verify keys are in `.env.local` (not `.env`)
- Check that `STRIPE_SECRET_KEY` is used only on the backend
- Ensure `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is needed if using Stripe.js directly

### Redirect Not Working
- Check that `NEXT_PUBLIC_BASE_URL` matches your domain
- Ensure success/cancel routes exist at the specified URLs
- Clear browser cache if testing locally

### Session Creation Fails
- Verify Stripe API keys are valid
- Check browser console for error messages
- Review server logs for detailed error information

## References
- [Stripe Checkout Documentation](https://stripe.com/docs/payments/checkout)
- [Stripe Session API](https://stripe.com/docs/api/checkout/sessions)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
