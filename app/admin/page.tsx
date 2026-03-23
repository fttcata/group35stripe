import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { supabase as adminSupabase } from '@/lib/supabaseClient'
import AdminDashboardClient from './AdminDashboardClient'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const supabase = await createSupabaseServerClient()

  // 1. Verify Authentication & Admin Status
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login')
  }

  // Only allow admin@group35.com
  if (user.email !== 'admin@group35.com') {
    redirect('/')
  }

  // 2. Fetch all required data across the entire platform using Admin Client to bypass RLS
  const { data: allProfiles, error: profilesError } = await adminSupabase!
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: allEvents, error: eventsError } = await adminSupabase!
    .from('events')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: allOrders, error: ordersError } = await adminSupabase!
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })

  if (profilesError || eventsError || ordersError) {
    console.error('Data Fetching Errors:', { profilesError, eventsError, ordersError })
    return (
      <div className='flex items-center justify-center p-8 bg-red-50 text-red-500 rounded-lg max-w-lg mx-auto mt-20'>
        <p className='font-semibold'>Error loading admin datasets. Check console.</p>
      </div>
    )
  }

  return (
    <main className='min-h-screen bg-gray-50/50'>
      <AdminDashboardClient 
        profiles={allProfiles || []} 
        events={allEvents || []} 
        orders={allOrders || []} 
      />
    </main>
  )
}
