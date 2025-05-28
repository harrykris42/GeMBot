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
      const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
      const endOfTomorrowIST = new Date(nowIST)
      endOfTomorrowIST.setDate(nowIST.getDate() + 1)
      endOfTomorrowIST.setHours(23, 59, 59, 999)

      const { data, error } = await supabase
        .from('live_bids')
        .select('*')
        .gte('end_date', nowIST.toISOString())
        .lte('end_date', endOfTomorrowIST.toISOString())
        .order('end_date', { ascending: true })

      if (!error && data) setBids(data)
      setLoading(false)
    }

    fetchBids()
  }, [])

  const getDayTag = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
    if (date.getDate() === now.getDate()) return 'Today'
    return 'Tomorrow'
  }

  const getTimeLeft = (end: string) => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
    const endTime = new Date(end)
    const diffMs = endTime.getTime() - now.getTime()
    if (diffMs < 0) return 'Expired'
    const hrs = Math.floor(diffMs / (1000 * 60 * 60))
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    return `in ${hrs}h ${mins}m`
  }

  return (
    <main className="p-6 font-sans max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">
        🪖 Indian Coast Guard Bids
      </h1>
      {loading ? (
        <p className="text-center text-gray-500">Loading bids...</p>
      ) : bids.length === 0 ? (
        <p className="text-center text-gray-500">No active bids ending today or tomorrow.</p>
      ) : (
        <div className="grid gap-6">
          {bids.map((bid) => (
            <div
              key={bid.bid_no}
              className="border rounded-xl p-5 shadow-sm bg-white hover:shadow-md transition"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-gray-800 font-semibold text-lg">
                    📌 Bid No: {bid.bid_no}
                  </p>
                  <p className="text-sm text-gray-500">
                    Ends {getTimeLeft(bid.end_date)} •{' '}
                    <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full">
                      {getDayTag(bid.end_date)}
                    </span>
                  </p>
                </div>
              </div>
              <a
                className="text-blue-600 hover:underline text-sm"
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
