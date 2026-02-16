# Group 35 - Athletic Events Ticketing Platform

A full-stack web application for creating, managing, and selling tickets for athletic events using Stripe payment processing.

**Live Demo:** [Deployed on Vercel](https://group35stripe.vercel.app)

## Features

### For Event Attendees
- **Browse Events** — View upcoming athletic events with filtering by date, sport category, and location
- **Interactive Map** — See event locations on an interactive Leaflet map
- **Flexible Checkout** — Purchase tickets as a guest (no account required) or with an account
- **Payment Options** — Pay now via Stripe or choose "Pay on Day" at check-in
- **Email Confirmations** — Receive tickets with QR codes via email
- **Multiple Ticket Types** — Select from different ticket tiers (General, Student, Over 60s, etc.)

### For Event Organizers
- **Event Management** — Create events with titles, descriptions, venues, images, dates, and sport categories
- **Ticket Configuration** — Define multiple ticket types with custom prices and quantities
- **Draft Events** — Save events as drafts before publishing

### For Event Staff
- **Attendee Lookup** — Search attendees by name, email, or ticket ID
- **QR Code Scanning** — Scan ticket QR codes for quick check-in
- **On-site Payments** — Process "Pay on Day" tickets at check-in

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS 4 |
| **Database** | [Supabase](https://supabase.com/) (PostgreSQL) |
| **Authentication** | Supabase Auth |
| **Payments** | [Stripe](https://stripe.com/) (Checkout, Webhooks) |
| **Email** | [Resend](https://resend.com/) |
| **Maps** | [Leaflet](https://leafletjs.com/) / React-Leaflet |
| **QR Codes** | qrcode |
| **Hosting** | [Vercel](https://vercel.com/) |
| **CI/CD** | GitLab CI → GitHub Mirror → Vercel |

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Stripe account (for payment processing)
- Supabase account (for database)
- Resend account (for transactional emails)

## Getting Started

### 1. Clone the repository

```bash
git clone https://gitlab.scss.tcd.ie/ttay/group35stripe.git
cd group35stripe
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the root directory:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Resend (Email)
RESEND_API_KEY=re_...

# App
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 4. Set up the database

Run the schema in your Supabase SQL editor (located at `db/schema.sql`).

Optionally seed with sample data:

```bash
npm run seed:supabase
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run seed:supabase` | Seed database with sample events |

## Project Structure

```
group35stripe/
├── app/
│   ├── api/                    # API routes
│   │   ├── auth/               # Authentication endpoints
│   │   ├── checkin/            # Check-in endpoints
│   │   ├── checkout/           # Stripe checkout session
│   │   ├── events/             # Event CRUD
│   │   ├── ticket-types/       # Ticket type management
│   │   ├── tickets/            # Ticket operations
│   │   └── webhooks/           # Stripe webhooks
│   ├── components/             # React components
│   ├── events/                 # Events pages
│   ├── buy/                    # Checkout page
│   ├── success/                # Payment success
│   ├── cancel/                 # Payment cancelled
│   ├── login/                  # Login page
│   ├── register/               # Registration page
│   ├── account/                # User account
│   └── submit-event/           # Event creation form
├── db/
│   ├── schema.sql              # Database schema
│   └── seeds.sql               # Sample data
├── lib/
│   ├── supabase/               # Supabase client utilities
│   └── supabaseClient.ts       # Direct Supabase client
├── public/                     # Static assets
└── scripts/
    └── seedSupabase.js         # Database seeding script
```

## Database Schema

| Table | Description |
|-------|-------------|
| `events` | Event details (title, date, venue, sport category, images) |
| `ticket_types` | Ticket tiers per event (name, price, quantity) |
| `orders` | Purchase records with payment status |
| `order_items` | Line items linking orders to ticket types |
| `tickets` | Individual tickets with QR codes and check-in status |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events` | List all published events |
| POST | `/api/checkout` | Create Stripe checkout session |
| POST | `/api/checkin` | Process pay-on-day registration |
| GET | `/api/ticket-types` | Get ticket types for an event |
| POST | `/api/webhooks/stripe` | Handle Stripe webhook events |

## Deployment

### Automatic Deployment (GitLab → GitHub → Vercel)

1. **GitLab** — Primary repository
2. **GitHub** — Mirror (auto-pushed from GitLab)
3. **Vercel** — Connected to GitHub, auto-deploys on push

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed setup instructions.

### Environment Variables (Vercel)

Add these in Vercel Project → Settings → Environment Variables:

- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `RESEND_API_KEY`
- `NEXT_PUBLIC_BASE_URL`

## Testing

```bash
# Run linting
npm run lint

# Run type checking
npm run typecheck
```

See [CI_TEST_CASES.md](CI_TEST_CASES.md) for CI/CD test documentation.

## Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Run linting and type checks
4. Push to GitLab and create a merge request

## Team

**Group 35** — Trinity College Dublin, Software Engineering Project

## License

This project is for educational purposes as part of the TCD Software Engineering curriculum.
