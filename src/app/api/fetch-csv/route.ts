export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')

  if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 })

  try {
    const res = await fetch(url)
    const text = await res.text()

    return new NextResponse(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    return NextResponse.json({ error: 'Fetch failed', detail: String(err) }, { status: 500 })
  }
}
