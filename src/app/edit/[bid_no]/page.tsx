'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Papa from 'papaparse'
import {
  DataGrid,
  GridColDef,
} from '@mui/x-data-grid'

const BUCKET = 'edited-csvs'

type Row = {
  id: number
  [key: string]: string | number
}

export default function EditCSVPage() {
  const { bid_no } = useParams() as { bid_no: string }
  const raw_bid_no = bid_no.replaceAll('-', '/')
  const safeFilename = bid_no + '.csv'
  const router = useRouter()

  const [rows, setRows] = useState<Row[]>([])
  const [columns, setColumns] = useState<GridColDef[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('Loading CSV...')

  const fetchCsvUrlFromTable = useCallback(async () => {
    const { data, error } = await supabase
      .from('live_bids')
      .select('csv')
      .eq('bid_no', raw_bid_no)
      .single()

    if (error || !data?.csv) throw new Error('❌ CSV link not found in table.')
    return data.csv
  }, [raw_bid_no])

  const uploadToBucket = useCallback(
    async (text: string) => {
      const { error } = await supabase.storage.from(BUCKET).upload(safeFilename, text, {
        contentType: 'text/csv',
        upsert: true,
      })
      if (error) throw error
    },
    [safeFilename]
  )

  const parseCsv = useCallback((csvText: string) => {
    const parsed = Papa.parse(csvText.trim(), { header: true })
    const headers = parsed.meta.fields || []

    if (!headers.includes('RATE(INCL GST)')) {
      (parsed.data as Record<string, string>[]).forEach((row) => {
        row['RATE(INCL GST)'] = ''
      })
      headers.push('RATE(INCL GST)')
    }

    const gridCols: GridColDef[] = headers.map((field) => ({
      field,
      headerName: field,
      flex: 1,
      editable: true,
    }))

    const gridRows: Row[] = (parsed.data as Record<string, string>[]).map((row, idx) => ({
      id: idx,
      ...row,
    }))

    setColumns(gridCols)
    setRows(gridRows)
  }, [])

  const loadOrDownloadCSV = useCallback(async () => {
    try {
      setStatus('📁 Checking bucket...')
      const { data: existing, error } = await supabase.storage.from(BUCKET).download(safeFilename)

      if (existing) {
        const text = await existing.text()
        parseCsv(text)
        setStatus('Loaded from bucket ✅')
        setLoading(false)
        return
      }

      if (error) console.warn('⚠️ No file in bucket:', error.message)

      const externalUrl = await fetchCsvUrlFromTable()
      const response = await fetch(`/api/fetch-csv?url=${encodeURIComponent(externalUrl)}`)

      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`)

      const blob = await response.blob()
      const text = await blob.text()

      const parsedData = Papa.parse(text, { header: true }).data as Record<string, string>[]
      parsedData.forEach((row) => {
        row['RATE(INCL GST)'] = row['RATE(INCL GST)'] || ''
      })

      const finalCsv = Papa.unparse(parsedData)
      await uploadToBucket(finalCsv)
      parseCsv(finalCsv)
      setStatus('Fetched, parsed, uploaded ✅')
      setLoading(false)
    } catch (err) {
      console.error(err)
      setStatus('❌ Failed to load CSV')
      setLoading(false)
    }
  }, [safeFilename, fetchCsvUrlFromTable, uploadToBucket, parseCsv])

  useEffect(() => {
    loadOrDownloadCSV()
  }, [loadOrDownloadCSV])

  const handleRowUpdate = async (updatedRow: Row) => {
    const newRows = rows.map((r) => (r.id === updatedRow.id ? updatedRow : r))
    setRows(newRows)
    setStatus('Saving...')

    const csvText = Papa.unparse(
  newRows.map(({ id: _id, ...rest }) => rest)
)


    try {
      await uploadToBucket(csvText)
      setStatus('All changes saved ✅')
    } catch (err) {
      console.error(err)
      setStatus('❌ Failed to save edits.')
    }

    return updatedRow
  }

  return (
    <main className="p-6 max-w-[1400px] mx-auto font-sans text-white bg-black min-h-screen">
      <div className="mb-6 flex justify-between items-center">
        <button
          onClick={() => router.push('/')}
          className="text-blue-400 underline text-sm"
        >
          🔙 Back to Active Bids
        </button>
        <h1 className="text-2xl font-bold">🧾 Editing CSV: {bid_no}</h1>
        <p className="text-green-400 text-sm">{status}</p>
      </div>

      {loading ? (
        <p>{status}</p>
      ) : (
        <div className="bg-white text-black rounded shadow overflow-x-auto">
          <DataGrid
            rows={rows}
            columns={columns}
            processRowUpdate={handleRowUpdate}
            
            autoHeight
            disableRowSelectionOnClick
            sx={{ fontSize: 14 }}
          />
        </div>
      )}
    </main>
  )
}
