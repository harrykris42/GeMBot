const puppeteer = require('puppeteer');
const { syncBidsToSupabase } = require('./supabase'); // make sure this path is correct

async function fetchDefenceBids() {
  const delay = ms => new Promise(res => setTimeout(res, ms));

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.goto('https://bidplus.gem.gov.in/advance-search', {
      waitUntil: 'networkidle2',
    });

    // Select filters
    await page.click('#ministry-tab');
    await page.click('#select2-ministry-container');
    await delay(200);
    await page.click('li[id*="Ministry of Defence"]');

    await page.click('#select2-organization-container');
    await delay(200);
    await page.click('li[id*="Indian Coast Guard"]');

    await page.click('#select2-department-container');
    await delay(200);
    await page.click('li[id*="Department of Defence"]');

    await delay(300);
    await page.evaluate(() => searchBid('ministry-search'));
    await delay(1000);

    const parseDate = raw => {
      try {
        const match = raw.match(/(\d{2})-(\d{2})-(\d{4}) (\d{1,2}):(\d{2}) (AM|PM)/);
        if (!match) return null;
        const [, dd, mm, yyyy, hourStr, minute, meridian] = match;
        let hour = parseInt(hourStr);
        if (meridian === 'PM' && hour !== 12) hour += 12;
        if (meridian === 'AM' && hour === 12) hour = 0;
        return new Date(`${yyyy}-${mm}-${dd}T${String(hour).padStart(2, '0')}:${minute}:00`);
      } catch {
        return null;
      }
    };

    let currentPage = 1;

    while (true) {
      console.log(`📄 Scraping page ${currentPage}`);
      await page.waitForSelector('.bid_no_hover');

      const pageBids = await page.evaluate(() => {
        const bidLinks = Array.from(document.querySelectorAll('a.bid_no_hover'));
        const startDates = Array.from(document.querySelectorAll('.start_date')).map(el => el.innerText.trim());
        const endDates = Array.from(document.querySelectorAll('.end_date')).map(el => el.innerText.trim());

        return bidLinks.map((link, i) => ({
          bid_no: link.innerText.trim(),
          boq: 'https://bidplus.gem.gov.in' + link.getAttribute('href'),
          start_date: startDates[i] || '',
          end_date: endDates[i] || ''
        }));
      });

      const formatted = pageBids.map(raw => ({
        bid_no: raw.bid_no,
        boq: raw.boq,
        start_date: parseDate(raw.start_date),
        end_date: parseDate(raw.end_date),
      }));

      // 🔄 Sync current page's bids immediately
      await syncBidsToSupabase(formatted);

      const nextBtn = await page.$('a.page-link.next');
      if (nextBtn) {
        await nextBtn.click();
        await delay(1000);
        currentPage++;
      } else {
        break;
      }
    }

  } catch (err) {
    console.error('❌ Error scraping:', err);
    console.log('🔍 Browser left open for inspection.');
  }

  await browser.close(); // close even if syncs per page
}

module.exports = fetchDefenceBids;
