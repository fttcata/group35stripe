import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StripeConnectButton from './StripeConnectButton'

export default async function AccountPage({ searchParams }: { searchParams?: { stripe?: string } }) {
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

  const role = profile?.role || user.user_metadata?.role || 'attendee'
  const fullName = profile?.full_name || user.user_metadata?.full_name || ''
  const stripeConnected = Boolean(profile?.stripe_account_id)
  const stripeStatus = searchParams?.stripe

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">My Account</h1>
        {stripeStatus === 'connected' && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            Payout setup complete. You can now receive earnings from ticket sales.
          </div>
        )}
        {stripeStatus === 'refresh' && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Payout setup needs a few more details. Please finish the onboarding steps.
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-500">Name</label>
            <p className="mt-1 text-gray-900">{fullName || '—'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500">Email</label>
            <p className="mt-1 text-gray-900">{user.email}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500">Role</label>
            <span className="mt-1 inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800 capitalize">
              {role}
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500">Member since</label>
            <p className="mt-1 text-gray-900">
              {new Date(user.created_at).toLocaleDateString('en-IE', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>

          {role === 'organizer' && (
            <StripeConnectButton connected={stripeConnected} />
          )}
        </div>
      </div>
    </div>
  )
}
