'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Bid = {
  id: string
  bid_no: string
  end_date: string
  boq: string
}

export default function Home() {
  const [bids, setBids] = useState<Bid[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBids = async () => {
      const { data, error } = await supabase
        .from('live_bids')
        .select('*')

      if (!error && data) setBids(data)
      setLoading(false)
    }

    fetchBids()
  }, [])

  return (
    <main className="p-6 font-sans">
      <h1 className="text-2xl font-bold mb-4">🪖 Indian Coast Guard Bids</h1>
      {loading ? (
        <p>Loading bids...</p>
      ) : (
        <div className="grid gap-4">
          {bids.map((bid) => (
            <div key={bid.id} className="border p-4 rounded shadow">
              <p className="font-semibold">📌 Bid No: {bid.bid_no}</p>
              <p>🕓 End: {bid.end_date}</p>
              <a
                className="text-blue-600 underline mt-1 inline-block"
                href={bid.boq}
                target="_blank"
                rel="noopener noreferrer"
              >
                🔗 View BOQ
              </a>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
