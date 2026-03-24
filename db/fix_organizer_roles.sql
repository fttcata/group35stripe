-- ============================================================
-- FIX ORGANIZER ROLES
-- Run this in the Supabase SQL editor to fix two issues:
-- 1. profiles CHECK constraint only allowed 'organizer' (American spelling)
--    but some users registered with 'organiser' in their metadata,
--    causing the trigger to fail and defaulting them to 'attendee'.
-- 2. Update any affected profiles where the user signed up as an
--    organizer/organiser but the profile shows 'attendee'.
-- ============================================================

-- STEP 1: Widen the CHECK constraint to allow both spellings
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('attendee', 'organizer', 'organiser'));

-- STEP 2: Fix profiles that were incorrectly created as 'attendee'
-- when the user's auth metadata says organizer or organiser.
UPDATE profiles
SET role = 'organizer',
    updated_at = NOW()
WHERE role = 'attendee'
  AND id IN (
    SELECT id FROM auth.users
    WHERE raw_user_meta_data->>'role' IN ('organizer', 'organiser')
  );

-- STEP 3: (Optional) Normalize all 'organiser' rows to 'organizer'
-- Only run this if you want consistent American spelling in the DB.
-- The application already handles both spellings in code.
-- UPDATE profiles SET role = 'organizer' WHERE role = 'organiser';

-- Verify
SELECT id, email, role FROM profiles ORDER BY role, email;
