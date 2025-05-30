import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { extractCsvFromPDF } from '@/lib/extractCsv'

export async function GET() {
  const { data: bids, error } = await supabase
    .from('live_bids')
    .select('bid_no, boq')
    .is('csv', null)
    .order('end_date', { ascending: true })
    .limit(10)

  if (error) {
    console.error('❌ Error fetching bids:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let updated = 0
  for (const bid of bids) {
    const csv = await extractCsvFromPDF(bid.boq)
    if (csv) {
      await supabase.from('live_bids').update({ csv }).eq('bid_no', bid.bid_no)
      updated++
      console.log(`✅ CSV added to bid: ${bid.bid_no}`)
    } else {
      console.warn(`⚠️ No CSV found in: ${bid.bid_no}`)
    }
  }

  return NextResponse.json({ updated })
}
