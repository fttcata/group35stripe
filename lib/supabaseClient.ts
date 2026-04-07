import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function isPlaceholder(value: string) {
  const normalized = value.trim().toLowerCase()
  return (
    !normalized ||
    normalized === 'your_service_role_secret' ||
    normalized.startsWith('your_') ||
    normalized.endsWith('...')
  )
}

const supabaseServiceKey = isPlaceholder(rawServiceKey) ? supabaseAnonKey : rawServiceKey

// Only create client if we have the required env vars
let supabase: SupabaseClient | null = null

if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey)
}

export { supabase }
export default supabase
