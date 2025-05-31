'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Bid = {
  bid_no: string
  end_date: string
  boq: string
  csv: string | null
}

export default function ArchivedPage() {
  const [bids, setBids] = useState<Bid[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchArchived = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('archived_bids')
      .select('*')
      .order('end_date', { ascending: false })
      .ilike('bid_no', `%${search}%`)

    if (!error && data) setBids(data)
    setLoading(false)
  }, [search])

  useEffect(() => {
    fetchArchived()
  }, [search, fetchArchived])

  return (
    <main className="p-6 font-sans max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">
        🗃️ Archived Bids
      </h1>

      <div className="mb-4 flex justify-between items-center">
        <input
          type="text"
          placeholder="Search bid number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border px-4 py-2 rounded w-full mr-4"
        />
        <Link
          href="/"
          className="px-4 py-2 bg-blue-600 text-white rounded whitespace-nowrap text-sm hover:bg-blue-700"
        >
          🔙 Back
        </Link>
      </div>

      {loading ? (
        <p className="text-center text-gray-500">Loading archived bids...</p>
      ) : bids.length === 0 ? (
        <p className="text-center text-gray-500">No archived bids found.</p>
      ) : (
        <div className="grid gap-6">
          {bids.map((bid) => (
            <div
              key={bid.bid_no}
              className="border rounded-xl p-5 shadow-sm transition bg-white opacity-70"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-gray-800 font-semibold text-lg">
                    📌 Bid No: {bid.bid_no}
                  </p>
                  <p className="text-sm text-gray-500">
                    Ended on{' '}
                    <span className="inline-block px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">
                      {new Date(bid.end_date).toLocaleString('en-IN')}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex gap-4 mt-2 text-sm">
                <a
                  className="text-blue-600 hover:underline"
                  href={bid.boq}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  📄 View BOQ
                </a>
                {bid.csv && (
                  <a
                    className="text-green-600 hover:underline"
                    href={bid.csv}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    📥 Download CSV
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
