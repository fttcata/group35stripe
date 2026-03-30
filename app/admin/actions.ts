'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { supabase as adminSupabase } from '@/lib/supabaseClient'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function checkAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== 'admin@group35.com') {
    throw new Error('Unauthorized - Admin only')
  }
}

export async function updateAccount(id: string, formData: FormData) {
  await checkAdmin()

  const full_name = formData.get('full_name') as string
  const role = formData.get('role') as string

  if (!full_name || !role) {
    throw new Error('Missing required fields')
  }

  // Update public profiles table
  const { error } = await adminSupabase!
    .from('profiles')
    .update({ full_name, role })
    .eq('id', id)

  if (error) {
    console.error('Error updating account profile:', error)
    throw new Error('Failed to update account')
  }

  // CRITICAL: We also need to update auth.users metadata because Middlewares and Pages check user_metadata.role
  const { error: authError } = await adminSupabase!.auth.admin.updateUserById(id, {
    user_metadata: { role, full_name }
  })

  if (authError) {
    console.error('Error updating auth user metadata:', authError)
    throw new Error('Failed to update auth permissions')
  }

  revalidatePath('/admin')
  // Go back to the correct tab in dashboard
  redirect(`/admin?tab=${role === 'organizer' ? 'organizers' : 'attendees'}`)
}

export async function deleteEvent(id: string) {
  await checkAdmin()

  const { count: orderCount, error: orderCountError } = await adminSupabase!
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', id)

  if (orderCountError) {
    console.error('Error checking event orders:', orderCountError)
    throw new Error('Unable to verify event orders before deletion')
  }

  if ((orderCount || 0) > 0) {
    throw new Error('Event has orders. Delete orders first or unpublish instead.')
  }

  const { error } = await adminSupabase!.from('events').delete().eq('id', id)

  if (error) {
    console.error('Error deleting event:', error)
    if (error.code === '23503') {
      throw new Error('Event cannot be deleted because related records still exist.')
    }
    throw new Error(error.message || 'Failed to delete event')
  }

  revalidatePath('/admin')
}

export async function deleteAccount(id: string) {
  await checkAdmin()

  // Deleting from auth.users might require special admin API functions
  // but deleting from profiles might cascade, or we can just delete from profiles.
  // Actually, better to use the admin auth api:
  const { error } = await adminSupabase!.auth.admin.deleteUser(id)

  if (error) {
    console.error('Error deleting account:', error)
    throw new Error('Failed to delete account')
  }

  revalidatePath('/admin')
  redirect('/admin')
}
