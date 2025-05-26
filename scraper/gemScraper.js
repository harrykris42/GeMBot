const puppeteer = require('puppeteer');

async function fetchDefenceBids() {
  const delay = ms => new Promise(res => setTimeout(res, ms));
  const bids = [];

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.goto('https://bidplus.gem.gov.in/advance-search', {
      waitUntil: 'networkidle2',
    });

    // Step 1: Click the "Ministry" tab
    await page.click('#ministry-tab');

    // Step 2: Select Ministry
    await page.click('#select2-ministry-container');
    await delay(200);
    await page.click('li[id*="Ministry of Defence"]');

    // Step 3: Select Organization
    await page.click('#select2-organization-container');
    await delay(200);
    await page.click('li[id*="Indian Coast Guard"]');

    // Step 4: Select Department
    await page.click('#select2-department-container');
    await delay(200);
    await page.click('li[id*="Department of Defence"]');

    // Step 5: Trigger search
    await delay(300);
    await page.evaluate(() => searchBid('ministry-search'));
    await delay(300);
    
    // Step 6: Get total number of bids
    const totalBids = await page.evaluate(() => {
      const text = document.querySelector('.pos-bottom')?.innerText || '';
      const match = text.match(/of (\d+) records/);
      return match ? parseInt(match[1]) : 0;
    });

    const totalPages = Math.floor(totalBids / 10);

    // Step 7: Scrape bids per page
    for (let pageNum = 0; pageNum <= totalPages; pageNum++) {
      await page.waitForSelector('.bid_no_hover');

      const pageBids = await page.evaluate(() => {
        const bidLinks = Array.from(document.querySelectorAll('a.bid_no_hover'));
        const startDates = Array.from(document.querySelectorAll('.start_date')).map(el => el.innerText.trim());
        const endDates = Array.from(document.querySelectorAll('.end_date')).map(el => el.innerText.trim());

        const parseDate = (raw) => {
          try {
            if (!raw) return null;
            const match = raw.match(/(\d{2})-(\d{2})-(\d{4}) (\d{1,2}):(\d{2}) (AM|PM)/);
            if (!match) return null;
            const [, dd, mm, yyyy, hourStr, minute, meridian] = match;
            let hour = parseInt(hourStr, 10);
            if (meridian === 'PM' && hour !== 12) hour += 12;
            if (meridian === 'AM' && hour === 12) hour = 0;
            return new Date(`${yyyy}-${mm}-${dd}T${String(hour).padStart(2, '0')}:${minute}:00`);
          } catch {
            return null;
          }
        };

        return bidLinks.map((link, i) => {
  const bid_no = link.innerText.trim();
  const boq = 'https://bidplus.gem.gov.in' + link.getAttribute('href');
  const startRaw = startDates[i] || '';
  const endRaw = endDates[i] || '';

  return {
    bid_no,
    boq,
    start_date: startRaw,
    end_date: endRaw,
  };
});

      });

      bids.push(...pageBids);

      // Step 8: Click "Next" if more pages remain
      if (pageNum < totalPages) {
        const nextBtn = await page.$('a.page-link[aria-label="Next"]');
        if (!nextBtn) break;
        await nextBtn.click();
        await page.waitForTimeout(1000);
      }
    }

  } catch (error) {
    console.error('Error fetching bids:', error);
    console.log('Browser left open for inspection.');
    return []; // Don't close browser on error
  }

  // Comment during debug if needed
  // await browser.close();

  return bids;
}

module.exports = fetchDefenceBids;
