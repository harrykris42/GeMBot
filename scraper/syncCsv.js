require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const Papa = require('papaparse');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET = 'edited-csvs';

function formatIST(date = new Date()) {
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
  });
}

function toISTISOString(date) {
  const tzOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(date.getTime() + tzOffset);
  return ist.toISOString().slice(0, 19).replace('T', ' ');
}

function formatFileName(bid_no, ext = 'csv') {
  return bid_no.replaceAll('/', '-') + '.' + ext;
}

async function downloadPDF(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to download PDF: ${res.statusText}`);
      const buffer = await res.arrayBuffer();
      const tmpPath = path.join(os.tmpdir(), `boq_${Date.now()}.pdf`);
      await fs.writeFile(tmpPath, Buffer.from(buffer));
      return tmpPath;
    } catch (err) {
      console.warn(`⚠️ Attempt ${attempt} failed for PDF: ${url}`);
      if (attempt === retries) throw new Error(`Final attempt failed: ${err.message}`);
      await new Promise(res => setTimeout(res, 2000 * attempt));
    }
  }
}

async function extractCsvFromPDF(pdfPath) {
  const doc = await pdfjsLib.getDocument(pdfPath).promise;
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const annotations = await page.getAnnotations();
    for (const ann of annotations) {
      if (ann.url && ann.url.endsWith('.csv')) return ann.url;
    }
  }
  return null;
}

async function downloadCsvBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CSV download failed: ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

function csvToHtmlTable(csvText) {
  const rows = Papa.parse(csvText).data.filter(r => r.length > 1);
  const headers = rows[0];
  const bodyRows = rows.slice(1);

  const htmlRows = bodyRows.map(row => {
    const cells = row.map(cell =>
      `<td>${String(cell ?? '').trim()}</td>`
    ).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  const headerCells = headers.map(h => `<th>${h}</th>`).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: A4 landscape;
      margin: 0;
    }
    body {
      margin: 0;
      font-family: sans-serif;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      table-layout: fixed;
    }
    th, td {
      border: 1px solid #aaa;
      padding: 4px;
      font-size: 10px;
      text-align: center;
      vertical-align: middle;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    th {
      background: #f0f0f0;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${htmlRows}</tbody>
  </table>
</body>
</html>`;
}

async function generatePdf(bid_no, csvTextWithCompliance) {
  const html = csvToHtmlTable(csvTextWithCompliance);
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    landscape: true,
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });

  await browser.close();

  const name = formatFileName(bid_no, 'pdf');
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(name, pdfBuffer, {
      upsert: true,
      contentType: 'application/pdf'
    });

  if (error) throw new Error('Failed PDF upload: ' + error.message);
}

async function uploadCleanCsv(bid_no, csvText) {
  const name = formatFileName(bid_no, 'csv');
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(name, csvText, {
      upsert: true,
      contentType: 'text/csv'
    });
  if (error) throw new Error('Failed CSV upload: ' + error.message);
}

async function archiveBidIfCsvMissing(bid_no) {
  const { data: fullBid, error: fetchError } = await supabase
    .from('live_bids')
    .select('*')
    .eq('bid_no', bid_no)
    .single();

  if (fetchError) {
    console.error(`❌ Could not fetch ${bid_no} for archiving: ${fetchError.message}`);
    return;
  }

  if (!fullBid.csv) {
    const { created_at, ...rest } = fullBid;
    const archivedBid = {
      ...rest,
      archived_at: new Date().toISOString()
    };

    const { error: archiveError } = await supabase
      .from('archived_bids')
      .insert([archivedBid]);

    if (archiveError) {
      console.error(`❌ Failed to archive ${bid_no}: ${archiveError.message}`);
    } else {
      const { error: deleteError } = await supabase
        .from('live_bids')
        .delete()
        .eq('bid_no', bid_no);

      if (deleteError) {
        console.error(`❌ Failed to delete ${bid_no} from live_bids: ${deleteError.message}`);
      } else {
        console.log(`📦 Archived ${bid_no} (no CSV found in PDF)`);
      }
    }
  } else {
    console.log(`🟡 Skipped ${bid_no} — already has a CSV in DB.`);
  }
}

async function syncCsvLinks() {
  console.log('📥 Checking bids with missing CSVs...');

  const now = new Date();
  const extraDays = now.getDay() === 6 ? 2 : 1;
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() + extraDays);
  cutoff.setHours(23, 59, 59, 999);

  console.log(`⏱ Now (IST): ${formatIST(now)}`);
  console.log(`📅 Cutoff (IST): ${formatIST(cutoff)}`);

  const { data: bids, error } = await supabase
    .from('live_bids')
    .select('bid_no, boq, csv')
    .gte('end_date', toISTISOString(now))
    .lte('end_date', toISTISOString(cutoff));

  if (error) return console.error('❌ Supabase error:', error.message);
  if (!bids.length) return console.log('✅ No pending bids.');

  console.log(`🧾 Total bids fetched: ${bids.length}`);
  console.log('📄 Bid numbers:', bids.map(b => b.bid_no));

  for (let i = 0; i < bids.length; i++) {
    const bid = bids[i];
    console.log(`🔁 ${i + 1}/${bids.length} — ${bid.bid_no}`);

    if (bid.csv) {
      console.log(`🟡 Skipping ${bid.bid_no} — already has CSV`);
      continue;
    }

    try {
      const pdfPath = await downloadPDF(bid.boq);
      const csvUrl = await extractCsvFromPDF(pdfPath);
      await fs.unlink(pdfPath);

      if (!csvUrl) {
        console.warn(`⚠️ No CSV in PDF for ${bid.bid_no}`);
        await archiveBidIfCsvMissing(bid.bid_no);
        continue;
      }

      const buffer = await downloadCsvBuffer(csvUrl);
      const text = buffer.toString();
      const parsed = Papa.parse(text, { header: true });

      parsed.data = parsed.data.filter(row =>
        Object.values(row).some(v => String(v).trim() !== '')
      );
      parsed.data.forEach(row => {
        row.Compliance = "YES";
      });

      const withCompliance = Papa.unparse(parsed.data);
      await generatePdf(bid.bid_no, withCompliance);

      const keys = Object.keys(parsed.data[0]);
      const cleaned = parsed.data.map(row => ({
        [keys[0]]: row[keys[0]],
        [keys[1]]: row[keys[1]],
        [keys[3]]: row[keys[3]],
        [keys[4]]: row[keys[4]],
        "RATE(INCL GST)": ""
      }));

      await uploadCleanCsv(bid.bid_no, Papa.unparse(cleaned));

      await supabase
        .from('live_bids')
        .update({ csv: csvUrl })
        .eq('bid_no', bid.bid_no);

      console.log(`✅ Done for ${bid.bid_no}`);
    } catch (err) {
      console.error(`❌ Unhandled error for ${bid.bid_no}: ${err.message}`);
    }
  }

  console.log('✅ Finished processing all bids.');
}

syncCsvLinks();
