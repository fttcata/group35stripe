import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabaseClient'

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const event_id = params.get('event_id')

    let query = supabase.from('ticket_types').select('id, event_id, name, price, quantity_available')
    if (event_id) query = query.eq('event_id', event_id)

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ticket_types: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
