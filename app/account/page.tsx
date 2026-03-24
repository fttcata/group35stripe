import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AccountClient from './AccountClient'

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const profileRole = (profile?.role || '').toLowerCase()
  const metaRole = String(user.user_metadata?.role || '').toLowerCase()
  const isOrganizerAccount = profileRole === 'organizer' || profileRole === 'organiser' || metaRole === 'organizer' || metaRole === 'organiser'
  const role = isOrganizerAccount ? (profileRole || metaRole) : (profileRole || metaRole || 'attendee')
  const fullName = profile?.full_name || user.user_metadata?.full_name || ''

  return (
    <AccountClient
      email={user.email || ''}
      fullName={fullName}
      role={role}
      memberSince={new Date(user.created_at).toLocaleDateString('en-IE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}
    />
  )
}
