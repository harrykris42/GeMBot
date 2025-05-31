require('dotenv').config()
const fs = require('fs/promises')
const path = require('path')
const os = require('os')
const { createClient } = require('@supabase/supabase-js')
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js')
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args))

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Download PDF to a temp file
async function downloadPDF(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download PDF: ${res.statusText}`)
  const buffer = await res.arrayBuffer()

  const tmpPath = path.join(os.tmpdir(), `temp_${Date.now()}.pdf`)
  await fs.writeFile(tmpPath, Buffer.from(buffer))
  return tmpPath
}

// Extract first hyperlink that ends with .csv
async function extractCsvFromPDF(pdfPath) {
  const doc = await pdfjsLib.getDocument(pdfPath).promise
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const annotations = await page.getAnnotations()
    for (const ann of annotations) {
      if (ann.url && ann.url.endsWith('.csv')) {
        return ann.url
      }
    }
  }
  return null
}

// Main function
async function syncCsvLinks() {
  console.log('📥 Fetching top 10 bids (no CSV, oldest end_date first)...')

  const now = new Date()
  const dayOfWeek = now.getDay() // 0 = Sunday, 6 = Saturday

  // Set the cutoff to tomorrow 11:59 PM by default
  const cutoff = new Date(now)

  // If today is Saturday, skip Sunday → target Monday 11:59 PM
  if (dayOfWeek === 6) {
    cutoff.setDate(cutoff.getDate() + 2) // +2 for Monday
  } else {
    cutoff.setDate(cutoff.getDate() + 1) // +1 for tomorrow
  }

  cutoff.setHours(23, 59, 59, 999) // End of day

  const { data: bids, error } = await supabase
    .from('live_bids')
    .select('bid_no, boq')
    .is('csv', null)
    .gte('end_date', now.toISOString())
    .lte('end_date', cutoff.toISOString())

  if (error) {
    console.error('❌ Supabase fetch error:', error.message)
    return
  }

  let updated = 0
  for (const bid of bids) {
    console.log(`🔎 Processing bid: ${bid.bid_no}`)
    try {
      const pdfPath = await downloadPDF(bid.boq)
      const csv = await extractCsvFromPDF(pdfPath)
      await fs.unlink(pdfPath)

      if (csv) {
        await supabase
          .from('live_bids')
          .update({ csv })
          .eq('bid_no', bid.bid_no)
        updated++
        console.log(`✅ CSV extracted: ${csv}`)
      } else {
        console.warn(`⚠️ No CSV link found in PDF for: ${bid.bid_no}`)
      }
    } catch (err) {
      console.error(`❌ Error processing ${bid.bid_no}:`, err.message)
    }
  }

  console.log(`🎉 Done. ${updated} bid(s) updated with CSV links.`)
}

syncCsvLinks()
