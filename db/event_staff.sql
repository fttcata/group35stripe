-- Event staff invitations and memberships
-- Run this after db/schema.sql in Supabase SQL editor.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

CREATE TABLE IF NOT EXISTS public.event_staff_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  invite_code text NOT NULL,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'revoked')),
  claimed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_staff_invites_email_lower CHECK (invited_email = lower(invited_email)),
  CONSTRAINT event_staff_invites_code_upper CHECK (invite_code = upper(invite_code)),
  UNIQUE (event_id, invited_email),
  UNIQUE (invite_code)
);

CREATE TABLE IF NOT EXISTS public.event_staff_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source_invite_id uuid REFERENCES public.event_staff_invites(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_staff_invites_event_id ON public.event_staff_invites(event_id);
CREATE INDEX IF NOT EXISTS idx_event_staff_invites_email ON public.event_staff_invites(invited_email);
CREATE INDEX IF NOT EXISTS idx_event_staff_memberships_user_id ON public.event_staff_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_event_staff_memberships_event_id ON public.event_staff_memberships(event_id);
