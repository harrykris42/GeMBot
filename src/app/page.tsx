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
      const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
      const isSaturday = now.getDay() === 6

      const tomorrow = new Date(now)
      tomorrow.setDate(now.getDate() + (isSaturday ? 2 : 1)) // Skip Sunday if Saturday
      tomorrow.setHours(23, 59, 59, 999)

      const { data, error } = await supabase
        .from('live_bids')
        .select('*')
        .gte('end_date', now.toISOString())
        .lte('end_date', tomorrow.toISOString())
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
        <p className="text-center text-gray-500">No active bids found.</p>
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
