-- ==========================================================
-- Assign seeded events to the first organiser account.
--
-- Run this once from the Supabase SQL editor AFTER you have
-- at least one registered organiser account in the profiles
-- table.  Safe to re-run (no-op if events already have a
-- created_by value).
-- ==========================================================

DO $$
DECLARE
  organizer_id uuid;
BEGIN
  -- Find the first organiser profile (either spelling)
  SELECT id INTO organizer_id
  FROM profiles
  WHERE LOWER(role) IN ('organizer', 'organiser')
  ORDER BY created_at
  LIMIT 1;

  IF organizer_id IS NULL THEN
    RAISE NOTICE 'No organiser profile found — skipping.';
  ELSE
    UPDATE events
    SET created_by = organizer_id
    WHERE created_by IS NULL;

    RAISE NOTICE 'Assigned % event(s) to organiser %.',
      (SELECT COUNT(*) FROM events WHERE created_by = organizer_id),
      organizer_id;
  END IF;
END;
$$;
