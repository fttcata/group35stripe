-- SQL schema for ticketing system

-- Enable pgcrypto for gen_random_uuid if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  date timestamptz NOT NULL,
  venue text,
  images text[] DEFAULT ARRAY[]::text[],
  created_at timestamptz DEFAULT now()
);

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
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  ticket_type_id uuid REFERENCES ticket_types(id),
  quantity integer NOT NULL,
  created_at timestamptz DEFAULT now()
);
