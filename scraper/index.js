const fetchDefenceBids = require('./gemScraper');

(async () => {
  console.log('Starting GeM scraper...');
  await fetchDefenceBids(); // no return value now
  console.log('✅ Scraping complete.');
})();
