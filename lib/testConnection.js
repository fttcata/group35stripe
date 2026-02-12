/* eslint-disable @typescript-eslint/no-require-imports */
// lib/testConnection.js
const { createClient } = require('@supabase/supabase-js')
const path = require('path')

// Load environment variables from root directory
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

// Verify environment variables are loaded
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL is not set in .env.local')
  process.exit(1)
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is not set in .env.local')
  process.exit(1)
}

console.log('✓ Environment variables loaded')
console.log('✓ Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function testSupabaseConnection() {
  console.log('\n🔄 Testing Supabase connection...\n')
  
  try {
    const { data, error } = await supabase
      .from('test_table1')
      .select('*')
      .limit(2)

    if (error) {
      console.error('❌ Supabase connection failed:', error.message)
      console.error('Full error:', error)
      return
    }

    console.log('✅ Supabase connection successful!')
    console.log('📊 Data retrieved:', data)
    
    if (data.length === 0) {
      console.log('\n⚠️  Note: test_table exists but has no rows')
      console.log('   Add a row in Supabase dashboard or run this SQL:')
      console.log('   INSERT INTO test_table (message) VALUES (\'Test successful!\');')
    }
  } catch (err) {
    console.error('❌ Unexpected error:', err)
  }
}

// Run the test
testSupabaseConnection()