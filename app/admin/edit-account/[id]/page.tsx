import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { supabase as adminSupabase } from '@/lib/supabaseClient'
import { updateAccount, deleteAccount } from '../../actions'
import Link from 'next/link'

export const metadata = {
  title: 'Edit Account | Admin Dashboard',
}

export default async function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== 'admin@group35.com') {
    redirect('/')
  }

  const { data: profile, error } = await adminSupabase!
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !profile) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center bg-red-50 mt-12 rounded-xl">
        <h2 className="text-2xl font-bold text-red-700">Account not found</h2>
        <Link href="/admin" className="text-indigo-600 hover:underline mt-4 inline-block">Back to Dashboard</Link>
      </div>
    )
  }

  const updateWithId = updateAccount.bind(null, id)
  const deleteWithId = deleteAccount.bind(null, id)

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Edit Account</h1>
        <Link href="/admin" className="text-gray-600 hover:text-gray-900 bg-gray-100 px-4 py-2 rounded-lg font-medium">
          Back to Dashboard
        </Link>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <form action={updateWithId} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email Address (Read-only)</label>
            <input
              type="email"
              disabled
              value={profile.email}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 shadow-sm"
            />
          </div>

          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">Full Name</label>
            <input
              type="text"
              name="full_name"
              id="full_name"
              defaultValue={profile.full_name || ''}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700">Role</label>
            <select
              name="role"
              id="role"
              defaultValue={profile.role}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
            >
              <option value="attendee">Attendee</option>
              <option value="organizer">Organizer</option>
            </select>
          </div>

          <div className="flex gap-4 pt-4 border-t">
            <button
              type="submit"
              className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Save Changes
            </button>
          </div>
        </form>
        <form action={deleteWithId} className="px-6 pb-6">
          <button
            type="submit"
            className="w-full bg-red-50 text-red-600 py-2 px-4 rounded-lg font-medium border border-red-200 hover:bg-red-100 transition-colors"
          >
            Delete Account (Immediate)
          </button>
        </form>
      </div>
    </div>
  )
}
