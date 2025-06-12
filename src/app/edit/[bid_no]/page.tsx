'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Papa from 'papaparse'
import { DataGrid, GridColDef } from '@mui/x-data-grid'
import debounce from 'lodash.debounce'

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

  const idleTimer = useRef<NodeJS.Timeout | null>(null)

  const fetchCsvUrlFromTable = useCallback(async () => {
    const { data, error } = await supabase
      .from('live_bids')
      .select('csv')
      .eq('bid_no', raw_bid_no)
      .single()

    if (error || !data?.csv) throw new Error('❌ CSV link not found in table.')
    return data.csv
  }, [raw_bid_no])

  const uploadCsvToBucket = useCallback(
    async (csvText: string) => {
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(safeFilename, csvText, {
          contentType: 'text/csv',
          upsert: true,
        })

      if (error) throw error
    },
    [safeFilename]
  )

  const saveDebounced = useRef(
    debounce(async (rowsToSave: Row[]) => {
      const csvText = Papa.unparse(rowsToSave.map(({ id: _id, ...rest }) => rest))
      try {
        await uploadCsvToBucket(csvText)
        setStatus('✅ Auto-saved')
      } catch (err) {
        console.error(err)
        setStatus('❌ Failed to auto-save')
      }
    }, 2000)
  ).current

  const loadCsv = useCallback(async () => {
    try {
      setStatus('📁 Checking bucket...')
      const { data: existing, error: _eroor } = await supabase.storage.from(BUCKET).download(safeFilename)

      let csvText: string

      if (existing) {
        csvText = await existing.text()
        setStatus('✅ Loaded from bucket')
      } else {
        const externalUrl = await fetchCsvUrlFromTable()
        const response = await fetch(`/api/fetch-csv?url=${encodeURIComponent(externalUrl)}`)
        if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`)
        csvText = await response.text()
        setStatus('✅ Fetched external CSV')
      }

      const parsed = Papa.parse(csvText, { header: true })
      const data = parsed.data as Record<string, string>[]

      const gridCols: GridColDef[] = Object.keys(data[0] || {}).map((field) => ({
        field,
        headerName: field,
        flex: 1,
        editable: true,
      }))

      const gridRows: Row[] = data.map((row, idx) => ({ id: idx, ...row }))
      setColumns(gridCols)
      setRows(gridRows)
      setStatus('✅ CSV ready')
      setLoading(false)
    } catch (err) {
      console.error(err)
      setStatus('❌ Failed to load CSV')
      setLoading(false)
    }
  }, [fetchCsvUrlFromTable, safeFilename])

  useEffect(() => {
    loadCsv()
  }, [loadCsv])

  const handleRowUpdate = async (updatedRow: Row) => {
    const newRows = rows.map((r) => (r.id === updatedRow.id ? updatedRow : r))
    setRows(newRows)
    setStatus('💾 Saving...')

    const csvText = Papa.unparse(newRows.map(({ id: _id, ...rest }) => rest))

    try {
      await uploadCsvToBucket(csvText)
      setStatus('✅ Changes saved')
    } catch (err) {
      console.error(err)
      setStatus('❌ Failed to save edit')
    }

    return updatedRow
  }

  // Idle save every 10 seconds
  useEffect(() => {
    if (!loading) {
      idleTimer.current = setInterval(() => {
        saveDebounced(rows)
      }, 10000)
    }
    return () => {
      if (idleTimer.current) clearInterval(idleTimer.current)
    }
  }, [rows, loading, saveDebounced])

  return (
    <main className="p-6 max-w-[1400px] mx-auto font-sans text-white bg-black min-h-screen">
      <div className="mb-6 flex justify-between items-center">
        <button onClick={() => router.push('/')} className="text-blue-400 underline text-sm">
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
