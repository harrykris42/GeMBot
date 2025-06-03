export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  console.log('🚀 Incoming fetch request for:', url)

  if (!url) {
    console.log('❌ No URL provided')
    return NextResponse.json({ error: 'No URL provided' }, { status: 400 })
  }

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store'
    })

    console.log('📡 External fetch status:', res.status)

    if (!res.ok) {
      throw new Error(`Fetch failed: ${res.statusText}`)
    }

    const text = await res.text()
    return new NextResponse(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Cache-Control': 'no-cache'
      },
    })
  } catch (err) {
    console.error('❌ Fetch failed in route.ts:', err)
    return NextResponse.json({ error: 'Fetch failed', detail: String(err) }, { status: 500 })
  }
}
