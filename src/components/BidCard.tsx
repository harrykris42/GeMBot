'use client'

type Bid = {
  bid_no: string
  end_date: string
  boq: string
  csv?: string | null
}

type Props = {
  bid: Bid
}

export default function BidCard({ bid }: Props) {
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
    const isSaturday = now.getDay() === 6
    const tomorrow = new Date(now)
    tomorrow.setDate(now.getDate() + (isSaturday ? 2 : 1))
    if (date.getDate() === now.getDate()) return 'Today'
    if (date.getDate() === tomorrow.getDate()) return isSaturday ? 'Monday' : 'Tomorrow'
    return date.toDateString()
  }

  return (
    <div
      key={bid.bid_no}
      className="border rounded-xl p-5 shadow-sm transition bg-white hover:shadow-md"
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-gray-800 font-semibold text-lg">📌 Bid No: {bid.bid_no}</p>
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
            href={`/edit/${bid.bid_no.replaceAll('/', '-')}`}
          >
            ✏️ Edit CSV
          </a>
        )}
      </div>
    </div>
  )
}
