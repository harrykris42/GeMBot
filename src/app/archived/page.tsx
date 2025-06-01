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

export default function Archived() {
  const [bids, setBids] = useState<Bid[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchArchived = async () => {
      const { data, error } = await supabase
        .from('archived_bids')
        .select('*')
        .not('csv', 'is', null) // ✅ filter only bids with CSV links
        .order('end_date', { ascending: false })

      if (!error && data) setBids(data)
      setLoading(false)
    }

    fetchArchived()
  }, [])

  return (
    <main className="p-6 font-sans max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">📁 Archived Bids</h1>
        <Link href="/" className="text-blue-600 hover:underline text-sm">
          🔙 Back to Active
        </Link>
      </div>

      {loading ? (
        <p className="text-center text-gray-500">Loading archived bids...</p>
      ) : bids.length === 0 ? (
        <p className="text-center text-gray-500">No archived bids with CSV links found.</p>
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
