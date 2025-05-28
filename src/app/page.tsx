'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Bid = {
  bid_no: string
  end_date: string
  boq: string
}

export default function Home() {
  const [bids, setBids] = useState<Bid[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBids = async () => {
      // Get current IST time
      const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const endOfTomorrowIST = new Date(nowIST);
      endOfTomorrowIST.setDate(nowIST.getDate() + 1);
      endOfTomorrowIST.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('live_bids')
        .select('*')
        .gte('end_date', nowIST.toISOString())
        .lte('end_date', endOfTomorrowIST.toISOString())
        .order('end_date', { ascending: true });

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
            <div key={bid.bid_no} className="border p-4 rounded shadow">
              <p className="font-semibold">📌 Bid No: {bid.bid_no}</p>
              <p>🕓 End: {new Date(bid.end_date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
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
