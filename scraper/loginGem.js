require('dotenv').config();
const puppeteer = require('puppeteer');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const USERNAME = 'DINESHAN';
const PASSWORD = 'hARRY_@42779_';
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function solveCaptcha(imageBuffer, attemptId) {
  const preprocessed = await sharp(imageBuffer)
    .resize(250, 80)
    .grayscale()
    .normalize()
    .toBuffer();

  const filePath = path.join(__dirname, `captcha_${attemptId}.png`);
  fs.writeFileSync(filePath, preprocessed);

  const { data: { text } } = await Tesseract.recognize(filePath, 'eng', {
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  });

  const solvedText = text.replace(/[^A-Z0-9]/g, '').trim();
  fs.unlinkSync(filePath);
  return solvedText;
}

async function safeGotoWithStopAndReload(page, url, maxRetries = 3) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      console.log(`🌐 Navigating to ${url} (Attempt ${attempt + 1})`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      return true;
    } catch (err) {
      console.warn(`⚠️ Attempt ${attempt + 1} failed: ${err.message}`);

      try {
        const client = await page.target().createCDPSession();
        await client.send('Page.stopLoading');
        console.log('⛔ Page loading stopped manually');
      } catch (stopErr) {
        console.warn('⚠️ Could not stop loading:', stopErr.message);
      }

      await new Promise(res => setTimeout(res, 2000));
      attempt++;
    }
  }

  throw new Error(`❌ Failed to load ${url} after ${maxRetries} attempts.`);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized'],
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36');
  await page.setExtraHTTPHeaders({ DNT: '1' });

  const client = await page.target().createCDPSession();
  await client.send('Network.clearBrowserCookies');

  // 🔐 Go to login page (with timeout recovery)
  await safeGotoWithStopAndReload(page, 'https://sso.gem.gov.in/ARXSSO/oauth/login');

  let attempt = 1;
  while (true) {
    console.log(`🔁 Attempt ${attempt}: Solving CAPTCHA...`);

    try {
      await page.waitForSelector('#loginid', { timeout: 10000 });
      await page.evaluate(() => { document.querySelector('#loginid').value = ''; });
      await page.type('#loginid', USERNAME, { delay: 50 });

      await page.waitForFunction(() => {
        const img = document.querySelector('#captcha1');
        return img && img.complete && img.naturalHeight !== 0;
      }, { timeout: 10000 });

      const captchaImg = await page.$('#captcha1');
      const imageBuffer = await captchaImg.screenshot();
      const captchaText = await solveCaptcha(imageBuffer, attempt);

      console.log(`🔎 CAPTCHA solved: "${captchaText}"`);

      if (!captchaText || captchaText.length < 4) {
        throw new Error('OCR too short');
      }

      await page.evaluate(() => { document.querySelector('#captcha_math').value = ''; });
      await page.type('#captcha_math', captchaText, { delay: 50 });

      await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => null),
      ]);

      const passwordField = await page.$('#password');
      if (passwordField) {
        break;
      }

    } catch (err) {
      console.log(`❌ CAPTCHA failed: ${err.message}`);
    }

    attempt++;
    await page.reload({ waitUntil: 'domcontentloaded' });
  }

  // 🔒 Enter password
  await page.type('#password', PASSWORD, { delay: 50 });
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => null),
  ]);

  // 🚀 Go to seller-bids page (with retry support)
  await safeGotoWithStopAndReload(page, 'https://bidplus.gem.gov.in/auth/autologin/sbl');
  console.log('✅ Reached seller-bids page.');

  // 🔽 Click dropdown "Contains ▼"
  await page.waitForSelector('button.searchtype');
  await page.click('button.searchtype');

  // Wait a bit
  await new Promise(res => setTimeout(res, 500));

  // ✅ Select "Exact Search"
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('a'))
      .find(a => a.getAttribute('onclick') === "searchType('bid_search')");
    if (el) el.click();
  });

  // 🟢 Fetch bid_no from Supabase
  const { data, error } = await supabase
    .from('live_bids')
    .select('bid_no')
    .eq('status', 'SUBMITTING')
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    console.error('❌ No submitting bid found:', error || 'Not found');
    await browser.close();
    return;
  }

  const bidNo = data.bid_no.trim();
  console.log('📌 Using bid_no:', bidNo);

  // 🔍 Type and search bid number
  await page.waitForSelector('#searchBid');
  await page.type('#searchBid', bidNo, { delay: 50 });

  await page.evaluate(() => {
    const searchBtn = document.querySelector('#searchBidRA');
    if (searchBtn) searchBtn.click();
  });

  console.log('🔍 Search submitted.');
  // Wait for the Participate button to appear
await page.waitForSelector('input.participateBtn', { timeout: 10000 });

// Click the first participate button found (you can refine based on data-bid if needed)
await page.evaluate(() => {
  const btn = document.querySelector('input.participateBtn');
  if (btn) btn.click();
});

console.log('✅ Clicked Participate button');

// Wait for navigation to bid form page
await page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => null);
console.log('🔎 Checking for consent radio buttons...');

const radiosExist = await page.evaluate(() => {
  return (
    document.querySelector('#sell_con_no1') &&
    document.querySelector('#sell_con_no2') &&
    document.querySelector('#sell_con_yes3') &&
    document.querySelector('button[onclick="return saveConsent()"]')
  );
});

if (radiosExist) {
  await page.evaluate(() => {
    document.querySelector('#sell_con_no1').click();
    document.querySelector('#sell_con_no2').click();
    document.querySelector('#sell_con_yes3').click();
    document.querySelector('button[onclick="return saveConsent()"]').click();
  });

  console.log('✅ Consent radios selected and saved.');
} else {
  console.warn('⚠️ Consent radios not found — skipping.');
}
console.log('🔍 Searching for toggle buttons...');

const baseToggle = await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('[onclick^="$(\'.hidd_"]'));
  if (buttons.length === 0) return null;

  const firstOnclick = buttons[0].getAttribute('onclick');
  const match = firstOnclick.match(/hidd_(\d+)\'\)/);
  if (!match) return null;

  return {
    count: buttons.length,
    baseNumber: parseInt(match[1], 10)
  };
});

if (!baseToggle || !baseToggle.count || isNaN(baseToggle.baseNumber)) {
  console.warn('⚠️ No toggle buttons found.');
} else {
  console.log(`🔢 Found ${baseToggle.count} toggle panels starting from ID ${baseToggle.baseNumber}`);

  for (let i = 0; i < baseToggle.count; i++) {
    const toggleNumber = baseToggle.baseNumber + i;
    const toggleSelector = `[onclick="$('.hidd_${toggleNumber}').toggle();"]`;

    try {
      await page.waitForSelector(toggleSelector, { timeout: 5000 });
      await page.click(toggleSelector);
      console.log(`🟢 Opened panel .hidd_${toggleNumber}`);

      // Optional: wait for panel to expand
      await new Promise(res => setTimeout(res, 500));

      // Click Save and Continue button
      await page.waitForSelector('#saveBoq', { timeout: 10000 });
      await page.click('#saveBoq');
      console.log(`💾 Clicked Save and Continue after .hidd_${toggleNumber}`);
      
      // Wait for potential processing or page update
      await new Promise(res => setTimeout(res, 1000));
    } catch (err) {
      console.warn(`⚠️ Could not process .hidd_${toggleNumber}: ${err.message}`);
    }
  }
}
// ✅ Whether or not we found toggle buttons, always attempt to click final "Continue" button
try {
  await page.waitForSelector('#continue_button', { timeout: 10000 });
  await page.click('#continue_button');
  console.log('✅ Final "Continue" button clicked.');
} catch (err) {
  console.warn('⚠️ Could not find or click final "Continue" button:', err.message);
}

const fileName = bidNo.replaceAll('/', '-') + '.csv';
console.log(`📥 Fetching CSV from Supabase: ${fileName}`);

const { data: csvData, error: downloadError } = await supabase.storage
  .from('edited-csvs')
  .download(fileName);

if (downloadError) {
  console.error(`❌ Failed to download CSV: ${downloadError.message}`);
} else {
  const buffer = await csvData.arrayBuffer();
  const text = Buffer.from(buffer).toString();

  const rows = text.trim().split('\n').map(row => row.split(','));
  const lastColIndex = rows[0].length - 1;
  const values = rows.slice(1).map(row => row[lastColIndex]); // skip header

  console.log(`🔢 Filling ${values.length} priceInput fields from CSV...`);

  await page.evaluate((priceValues) => {
    const inputs = Array.from(document.querySelectorAll('input.priceInput'));
    for (let i = 0; i < Math.min(inputs.length, priceValues.length); i++) {
      inputs[i].value = '';
      inputs[i].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[i].value = priceValues[i];
      inputs[i].dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, values);

  console.log('✅ All priceInput fields filled from Supabase CSV.');
}

})();
