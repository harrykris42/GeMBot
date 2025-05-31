'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Bid = {
  bid_no: string
  end_date: string
  boq: string
  csv: string | null
}

export default function Home() {
  const [bids, setBids] = useState<Bid[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const PAGE_SIZE = 10
  const loadingRef = useRef(false)

  const getTimeFrame = () => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
    const end = new Date(now)
    const isSaturday = now.getDay() === 6
    end.setDate(end.getDate() + (isSaturday ? 2 : 1))
    end.setHours(23, 59, 59, 999)
    return { now, end }
  }

  const fetchActive = useCallback(async (reset = false) => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)

    const actualPage = reset ? 0 : page
    const from = actualPage * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const { now, end } = getTimeFrame()

    const { data, error } = await supabase
      .from('live_bids')
      .select('*')
      .gte('end_date', now.toISOString())
      .lte('end_date', end.toISOString())
      .ilike('bid_no', `%${search}%`)
      .order('end_date', { ascending: true })
      .range(from, to)

    if (!error && data) {
      if (reset) {
        setBids(data)
        setPage(1)
      } else {
        setBids(prev => [...prev, ...data])
        setPage(actualPage + 1)
      }

      if (data.length < PAGE_SIZE) setHasMore(false)
    }

    setLoading(false)
    loadingRef.current = false
  }, [page, search])

  useEffect(() => {
    fetchActive(true)
  }, [search, fetchActive])

  const handleScroll = useCallback(() => {
    const { scrollTop, clientHeight, scrollHeight } = document.documentElement
    if (scrollTop + clientHeight >= scrollHeight - 50 && !loadingRef.current && hasMore) {
      fetchActive()
    }
  }, [hasMore, fetchActive])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  const getTimeLeft = (end: string) => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
    const endTime = new Date(end)
    const diffMs = endTime.getTime() - now.getTime()
    if (diffMs < 0) return 'Expired'
    const hrs = Math.floor(diffMs / (1000 * 60 * 60))
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    return `in ${hrs}h ${mins}m`
  }

  const getDayTag = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
    if (date.getDate() === now.getDate()) return 'Today'
    const isSaturday = now.getDay() === 6
    const tomorrow = new Date(now)
    tomorrow.setDate(now.getDate() + (isSaturday ? 2 : 1))
    if (date.getDate() === tomorrow.getDate()) return isSaturday ? 'Monday' : 'Tomorrow'
    return date.toDateString()
  }

  return (
    <main className="p-6 font-sans max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">
        🪖 Indian Coast Guard Bids
      </h1>

      <div className="mb-4 flex justify-between items-center">
        <input
          type="text"
          placeholder="Search bid number..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
            setHasMore(true)
          }}
          className="border px-4 py-2 rounded w-full mr-4"
        />
        <Link
          href="/archived"
          className="px-4 py-2 bg-gray-200 rounded whitespace-nowrap text-sm hover:bg-gray-300"
        >
          📦 View Archived
        </Link>
      </div>

      {loading && bids.length === 0 ? (
        <p className="text-center text-gray-500">Loading bids...</p>
      ) : bids.length === 0 ? (
        <p className="text-center text-gray-500">No active bids found.</p>
      ) : (
        <div className="grid gap-6">
          {bids.map((bid) => (
            <div
              key={bid.bid_no}
              className="border rounded-xl p-5 shadow-sm transition bg-white hover:shadow-md"
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

      {loading && bids.length > 0 && (
        <p className="text-center text-gray-500 mt-6">Loading more...</p>
      )}
    </main>
  )
}
