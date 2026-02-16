-- Migration to add guest checkout fields to orders table

-- Add guest checkout columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_guest boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_email text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_phone text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_session_id text;

-- Create index on guest_email for quick lookups
CREATE INDEX IF NOT EXISTS idx_orders_guest_email ON orders(guest_email) WHERE is_guest = true;

-- Create index on stripe_session_id for webhook lookups
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders(stripe_session_id);

-- Allow guest orders (user_id can be null for guests)
ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN orders.is_guest IS 'True if this order was placed by a guest without an account';
COMMENT ON COLUMN orders.guest_name IS 'Name provided by guest during checkout';
COMMENT ON COLUMN orders.guest_email IS 'Email provided by guest during checkout';
COMMENT ON COLUMN orders.guest_phone IS 'Phone number provided by guest during checkout (optional)';
