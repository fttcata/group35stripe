import { createSupabaseServerClient } from '@/lib/supabase/server';

function isOrganizerRole(role: unknown): boolean {
  if (typeof role !== 'string') return false;
  const normalized = role.trim().toLowerCase();
  return normalized === 'organizer' || normalized === 'organiser';
}

export async function isAuthenticatedOrganizer(): Promise<boolean> {
  try {
    const serverClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) return false;

    const { data: profile } = await serverClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const roleFromProfile = profile?.role;
    const roleFromMetadata = user.user_metadata?.role;

    return isOrganizerRole(roleFromProfile) || isOrganizerRole(roleFromMetadata);
  } catch {
    // If auth context is unavailable, do not block guest checkout.
    return false;
  }
}
