import { createSupabaseServerClient } from '@/lib/supabase/server';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateInviteCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let value = '';
  for (let i = 0; i < length; i += 1) {
    value += chars[Math.floor(Math.random() * chars.length)];
  }
  return value;
}

export async function getAuthenticatedUserForRoute() {
  const serverClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await serverClient.auth.getUser();

  return user;
}

export async function isUserOrganizerForEvent(eventId: string, userId: string): Promise<boolean> {
  if (!eventId) return false;

  const serverClient = await createSupabaseServerClient();

  const { data: event } = await serverClient
    .from('events')
    .select('id, created_by')
    .eq('id', eventId)
    .single();

  if (!event) return false;

  if (!event.created_by) {
    return false;
  }

  return event.created_by === userId;
}

export async function isUserStaffForEvent(eventId: string, userId: string): Promise<boolean> {
  if (!eventId) return false;

  const serverClient = await createSupabaseServerClient();

  const { data: membership } = await serverClient
    .from('event_staff_memberships')
    .select('id, status')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  return !!membership;
}

export async function canUserScanEvent(eventId: string, userId: string): Promise<boolean> {
  if (!eventId) return false;
  if (await isUserStaffForEvent(eventId, userId)) return true;
  if (await isUserOrganizerForEvent(eventId, userId)) return true;
  return false;
}
