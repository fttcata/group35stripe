import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(_req: NextRequest) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const authSupabase = await createSupabaseServerClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (profile.role !== 'organizer') {
      return NextResponse.json({ error: 'Only organizers can disconnect Stripe' }, { status: 403 });
    }

    await adminSupabase
      .from('profiles')
      .update({ stripe_account_id: null })
      .eq('id', user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to disconnect Stripe' },
      { status: 500 }
    );
  }
}
