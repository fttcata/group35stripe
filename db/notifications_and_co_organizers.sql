-- ============================================================
-- Notifications & Co-Organizer Tables
-- Run this in your Supabase SQL editor after the base schema.
-- ============================================================

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('event_update', 'co_organizer_invite', 'co_organizer_accepted', 'ticket_confirmation', 'general')),
  title text NOT NULL,
  message text NOT NULL,
  link text,
  metadata jsonb DEFAULT '{}',
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read = false;

-- RLS for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Allow inserts from service role or authenticated users (for server-side notification creation)
CREATE POLICY "Service can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);


-- Co-organizers table
CREATE TABLE IF NOT EXISTS event_co_organizers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_co_organizers_event ON event_co_organizers(event_id);
CREATE INDEX IF NOT EXISTS idx_co_organizers_user ON event_co_organizers(user_id);

-- RLS for co-organizers
ALTER TABLE event_co_organizers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view co-organizer records for their events"
  ON event_co_organizers FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() = invited_by
    OR auth.uid() = (SELECT created_by FROM events WHERE id = event_id)
  );

CREATE POLICY "Organizers can insert co-organizer invites"
  ON event_co_organizers FOR INSERT
  WITH CHECK (
    auth.uid() = invited_by
    OR auth.uid() = (SELECT created_by FROM events WHERE id = event_id)
  );

CREATE POLICY "Users can update their own co-organizer status"
  ON event_co_organizers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Organizers can delete co-organizer records"
  ON event_co_organizers FOR DELETE
  USING (
    auth.uid() = invited_by
    OR auth.uid() = (SELECT created_by FROM events WHERE id = event_id)
  );
