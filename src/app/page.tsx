'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import BidCard from '@/components/BidCard'
import Link from 'next/link'

type Bid = {
  bid_no: string
  end_date: string
  boq: string
  csv?: string | null
}

export default function Home() {
  const [bids, setBids] = useState<Bid[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchActive = async () => {
      const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
      const tomorrow = new Date(nowIST)

      if (nowIST.getDay() === 6) {
        // Saturday → skip Sunday → show till Monday 11:59 PM
        tomorrow.setDate(nowIST.getDate() + 2)
      } else {
        tomorrow.setDate(nowIST.getDate() + 1)
      }
      tomorrow.setHours(23, 59, 59, 999)

      const { data, error } = await supabase
        .from('live_bids')
        .select('*')
        .gte('end_date', nowIST.toISOString())
        .lte('end_date', tomorrow.toISOString())
        .not('csv', 'is', null)
        .order('end_date', { ascending: true })

      if (!error && data) setBids(data)
      setLoading(false)
    }

    fetchActive()
  }, [])

  return (
    <main className="p-6 font-sans max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          🪖 Indian Coast Guard Bids
        </h1>
        <Link href="/archived" className="text-blue-600 hover:underline text-sm">
          📁 View Archived
        </Link>
      </div>

      {loading ? (
        <p className="text-center text-gray-500">Loading bids...</p>
      ) : bids.length === 0 ? (
        <p className="text-center text-gray-500">No active bids with CSV links.</p>
      ) : (
        <div className="grid gap-6">
          {bids.map((bid) => (
            <BidCard key={bid.bid_no} bid={bid} />
          ))}
        </div>
      )}
    </main>
  )
}
