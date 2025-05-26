// scraper/supabase.js
// Fix for "fetch failed" on some Node environments
if (!global.fetch) global.fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function syncBidsToSupabase(latestBids) {
  console.log('🔗 Connecting to:', process.env.SUPABASE_URL);
  const { data: existing, error } = await supabase
    .from('live_bids')
    .select('bid_no');

  if (error) throw new Error('Failed to fetch existing bids: ' + error.message);

  const existingBidNos = new Set(existing.map(b => b.bid_no));
  const latestBidNos = new Set(latestBids.map(b => b.bid_no));

  // Detect new bids
  const rawNewBids = latestBids.filter(b => !existingBidNos.has(b.bid_no));

// Log rejected ones
const rejected = rawNewBids.filter(
  b => !b.bid_no || !b.start_date || !b.end_date || !b.boq
);
if (rejected.length > 0) {
  console.warn(`⚠️ ${rejected.length} invalid bids skipped:`);
  for (const r of rejected) {
    console.warn(`  ⨯ Rejected bid:`, {
      bid_no: r.bid_no || '❌ MISSING',
      start_date: r.start_date,
      end_date: r.end_date,
      boq: r.boq,
    });
  }
}

// These are safe to insert
const newBids = rawNewBids.filter(
  b => b.bid_no && b.start_date && b.end_date && b.boq
);


  // Detect removed bids
  const removedBids = [...existingBidNos].filter(bid_no => !latestBidNos.has(bid_no));

  // Archive removed
  for (const bid_no of removedBids) {
    const { data, error: findError } = await supabase
      .from('live_bids')
      .select('*')
      .eq('bid_no', bid_no)
      .single();

    if (data) {
      await supabase.from('archived_bids').insert({
        ...data,
        archived_at: new Date().toISOString()
      });
      await supabase.from('live_bids').delete().eq('bid_no', bid_no);
    }
    if (findError) console.warn(`Failed to archive bid ${bid_no}: ${findError.message}`);
  }

  // Insert new
  if (newBids.length > 0) {
    const { error: insertError } = await supabase
      .from('live_bids')
      .upsert(newBids, { onConflict: 'bid_no' });

    if (insertError) {
      console.error('Failed to insert new bids:', insertError.message);
    } else {
      console.log(`${newBids.length} new bids inserted`);
    }
  } else {
    console.log('No new bids to insert.');
  }
}

module.exports = { syncBidsToSupabase };
