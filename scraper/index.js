// scraper/index.js
const fetchDefenceBids = require('./gemScraper');
const { syncBidsToSupabase } = require('./supabase');

(async () => {
  console.log('Starting GeM scraper...');
  const bids = await fetchDefenceBids();

  if (bids.length === 0) {
    console.warn('No bids scraped.');
    return;
  }

  console.log(`Fetched ${bids.length} bids. Syncing with Supabase...`);
  await syncBidsToSupabase(bids);
  console.log('✅ Sync complete.');
})();
