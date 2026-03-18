-- SQL schema for ticketing system

-- Enable pgcrypto for gen_random_uuid if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  date timestamptz NOT NULL,
  venue text,
  sport_category text,
  images text[] DEFAULT ARRAY[]::text[],
  location_url text,
  lat double precision,
  lng double precision,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

-- If the table already exists, add the new columns:
-- ALTER TABLE events ADD COLUMN IF NOT EXISTS location_url text;
-- ALTER TABLE events ADD COLUMN IF NOT EXISTS lat double precision;
-- ALTER TABLE events ADD COLUMN IF NOT EXISTS lng double precision;
-- ALTER TABLE events ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';
-- ALTER TABLE events ADD COLUMN IF NOT EXISTS created_by uuid;

-- Add check_in_code column to existing tickets table:
-- ALTER TABLE tickets ADD COLUMN IF NOT EXISTS check_in_code text;
-- UPDATE tickets SET check_in_code = LPAD(FLOOR(RANDOM() * 900000 + 100000)::text, 6, '0') WHERE check_in_code IS NULL;

CREATE TABLE IF NOT EXISTS ticket_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric(10,2) NOT NULL,
  quantity_available integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  event_id uuid REFERENCES events(id),
  total_amount numeric(10,2) NOT NULL,
  payment_status text NOT NULL DEFAULT 'pending',
  stripe_session_id text UNIQUE,\n  is_guest boolean DEFAULT false,\n  guest_name text,\n  guest_email text,\n  guest_phone text,\n  customer_email text,\n  payment_method text DEFAULT 'stripe',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  ticket_type_id uuid REFERENCES ticket_types(id),
  quantity integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  ticket_code text UNIQUE NOT NULL,
  check_in_code text NOT NULL,
  qr_code_data text NOT NULL,
  ticket_type text NOT NULL,
  is_used boolean DEFAULT false,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);
