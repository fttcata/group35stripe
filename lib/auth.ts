import { createSupabaseBrowserClient } from './supabase/client'

export async function getCurrentUser() {
  const supabase = createSupabaseBrowserClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getUserProfile(userId: string) {
  const supabase = createSupabaseBrowserClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Failed to fetch user profile:', error)
    return null
  }

  return data
}

export async function isUserOrganiser() {
  const user = await getCurrentUser()
  if (!user) return false

  const profile = await getUserProfile(user.id)
  return profile?.role === 'organiser'
}
