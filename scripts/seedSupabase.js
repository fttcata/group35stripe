/* eslint-disable no-console */
const path = require('path')
const fs = require('fs')

// Load .env.local manually (no dotenv dependency)
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8')
  content.split('\n').forEach((line) => {
    const [key, value] = line.split('=')
    if (key && value) {
      process.env[key.trim()] = value.trim()
    }
  })
}

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// If SUPABASE_DB_URL is provided, we can run the schema SQL automatically
const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL

async function runSchemaIfNeeded() {
  if (!dbUrl) return false
  try {
    const fs = require('fs')
    const { Client } = require('pg')
    const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8')
    const client = new Client({ connectionString: dbUrl })
    await client.connect()
    console.log('Running db/schema.sql via SUPABASE_DB_URL...')
    await client.query(sql)
    await client.end()
    console.log('Schema applied via direct Postgres connection.')
    return true
  } catch (err) {
    console.warn('Could not run schema via SUPABASE_DB_URL automatically:', err.message || err)
    return false
  }
}
async function ensureTables() {
  try {
    // simple check whether events table exists
    const { data, error } = await supabase.from('events').select('id').limit(1)
    if (error) {
      console.error('Could not access `events` table. Please run the SQL in db/schema.sql in your Supabase SQL editor first.')
      console.error('Full error:', error.message || error)
      process.exit(1)
    }
    return true
  } catch (err) {
    console.error('Unexpected error checking tables:', err)
    process.exit(1)
  }
}

async function seed() {
  const ranSchema = await runSchemaIfNeeded()
  if (!ranSchema) {
    // try to ensure tables exist via supabase; if they don't, instruct user
    await ensureTables()
  }

  // check if there are already events
  const { data: existing } = await supabase.from('events').select('id').limit(1)
  if (existing && existing.length > 0) {
    console.log('Events already present in database — skipping seed inserts.')
    return
  }

  console.log('Seeding sample events and ticket types...')

  const events = [
    { title: 'City Marathon 2026', description: 'Run through the city landmarks.', date: '2026-05-15T09:00:00Z', venue: 'City Center', sport_category: 'Running', images: ['/images/marathon1.jpg'] },
    { title: 'Trail Run Adventure', description: 'A challenging trail run in the hills.', date: '2026-06-20T08:00:00Z', venue: 'Hill Park', sport_category: 'Running', images: ['/images/trail1.jpg','/images/trail2.jpg'] },
    { title: '5K Charity Fun Run', description: 'Family-friendly 5K to raise funds.', date: '2026-04-10T10:00:00Z', venue: 'Community Grounds', sport_category: 'Running', images: ['/images/5k.jpg'] },
    { title: 'Night Relay', description: 'Team relay race under lights.', date: '2026-07-02T20:00:00Z', venue: 'Stadium', sport_category: 'Running', images: ['/images/relay.jpg'] },
    { title: 'Ultra Endurance Challenge', description: 'Ultra-distance event for experienced runners.', date: '2026-08-14T06:00:00Z', venue: 'Lakeside', sport_category: 'Running', images: ['/images/ultra.jpg'] }
  ]

  const { data: insertedEvents, error: insertErr } = await supabase.from('events').insert(events).select('id,title')
  if (insertErr) {
    console.error('Failed to insert events:', insertErr.message || insertErr)
    process.exit(1)
  }

  // create ticket types for each inserted event by title
  const ticketInserts = []
  for (const ev of insertedEvents) {
    if (ev.title === 'City Marathon 2026') {
      ticketInserts.push({ event_id: ev.id, name: 'General Admission', price: 25.00, quantity_available: 500 })
      ticketInserts.push({ event_id: ev.id, name: 'VIP', price: 80.00, quantity_available: 50 })
    }
    if (ev.title === 'Trail Run Adventure') {
      ticketInserts.push({ event_id: ev.id, name: 'Trail Entry', price: 35.00, quantity_available: 300 })
    }
    if (ev.title === '5K Charity Fun Run') {
      ticketInserts.push({ event_id: ev.id, name: '5K Adult', price: 15.00, quantity_available: 400 })
      ticketInserts.push({ event_id: ev.id, name: '5K Child', price: 8.00, quantity_available: 200 })
    }
    if (ev.title === 'Night Relay') {
      ticketInserts.push({ event_id: ev.id, name: 'Team Relay', price: 120.00, quantity_available: 80 })
    }
    if (ev.title === 'Ultra Endurance Challenge') {
      ticketInserts.push({ event_id: ev.id, name: 'Ultra Early Bird', price: 150.00, quantity_available: 50 })
    }
  }

  const { data: tickets, error: ticketErr } = await supabase.from('ticket_types').insert(ticketInserts).select()
  if (ticketErr) {
    console.error('Failed to insert ticket types:', ticketErr.message || ticketErr)
    process.exit(1)
  }

  const ticketCount = tickets ? tickets.length : ticketInserts.length
  console.log('Seed complete. Inserted', insertedEvents.length, 'events and', ticketCount, 'ticket types.')
}

seed().catch((err) => {
  console.error('Seed script error:', err)
  process.exit(1)
})
