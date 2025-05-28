// scraper/supabase.js

if (!global.fetch) global.fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args))

require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function syncBidsToSupabase(latestBids) {
  console.log('🔗 Connecting to:', process.env.SUPABASE_URL)

  const { data: existing, error } = await supabase
    .from('live_bids')
    .select('bid_no')

  if (error) throw new Error('Failed to fetch existing bids: ' + error.message)

  const existingBidNos = new Set(existing.map(b => b.bid_no))

  const validNewBids = latestBids.filter(b =>
    b.bid_no && b.start_date && b.end_date && b.boq && !existingBidNos.has(b.bid_no)
  )

  const rejected = latestBids.filter(b =>
    !b.bid_no || !b.start_date || !b.end_date || !b.boq
  )

  if (rejected.length > 0) {
    console.warn(`⚠️ ${rejected.length} invalid bids skipped:`)
    rejected.forEach(r => {
      console.warn(`  ⨯ Rejected bid:`, {
        bid_no: r.bid_no || '❌ MISSING',
        start_date: r.start_date,
        end_date: r.end_date,
        boq: r.boq,
      })
    })
  }

  if (validNewBids.length === 0) {
    console.log('✅ No new bids to insert.')
    return
  }

  const { error: insertError } = await supabase
    .from('live_bids')
    .upsert(validNewBids, {
      onConflict: 'bid_no',
      ignoreDuplicates: true,
    })

  if (insertError) {
    console.error('❌ Failed to insert new bids:', insertError.message)
  } else {
    console.log(`✅ ${validNewBids.length} new bids inserted.`)
  }
}

module.exports = { syncBidsToSupabase }
