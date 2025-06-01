'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Papa from 'papaparse'
import {
  DataGrid,
  GridColDef,
  GridRowsProp,
  GridCellEditStopParams,
} from '@mui/x-data-grid'
import 'react-data-grid/lib/styles.css'

const BUCKET = 'edited-csvs'

export default function EditCSVPage() {
  const { bid_no } = useParams() as { bid_no: string }
  const router = useRouter()

  const [rows, setRows] = useState<GridRowsProp>([])
  const [columns, setColumns] = useState<GridColDef[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('Loading CSV...')

  const safeFilename = bid_no.replace(/\//g, '-') + '.csv'

  const fetchCsvUrlFromTable = useCallback(async () => {
    const { data, error } = await supabase
      .from('live_bids')
      .select('csv')
      .eq('bid_no', bid_no)
      .single()

    if (error || !data?.csv) throw new Error('CSV link not found in table.')
    return data.csv
  }, [bid_no])

  const uploadToBucket = useCallback(
    async (text: string) => {
      await supabase.storage.from(BUCKET).upload(safeFilename, text, {
        contentType: 'text/csv',
        upsert: true,
      })
    },
    [safeFilename]
  )

  const parseCsv = (csvText: string) => {
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

    const gridRows = (parsed.data as Record<string, string>[]).map((row, idx) => ({
      id: idx,
      ...row,
    }))

    setColumns(gridCols)
    setRows(gridRows)
  }

  const loadOrDownloadCSV = useCallback(async () => {
    try {
      setStatus('Checking existing CSV...')
      const { data: existing } = await supabase.storage.from(BUCKET).download(safeFilename)

      if (existing) {
        const text = await existing.text()
        setStatus('Loaded from bucket.')
        parseCsv(text)
        setLoading(false)
        return
      }

      setStatus('Fetching from external link...')
      const externalUrl = await fetchCsvUrlFromTable()
      const response = await fetch(externalUrl)
      const blob = await response.blob()
      const text = await blob.text()

      parseCsv(text)

      const parsedData = Papa.parse(text, { header: true }).data as Record<string, string>[]
      parsedData.forEach((row) => {
        row['RATE(INCL GST)'] = ''
      })

      await uploadToBucket(Papa.unparse(parsedData))

      setStatus('Initialized and uploaded to bucket.')
      setLoading(false)
    } catch (err) {
      console.error(err)
      setStatus('Failed to load CSV.')
      setLoading(false)
    }
  }, [fetchCsvUrlFromTable, uploadToBucket, safeFilename])

  useEffect(() => {
    loadOrDownloadCSV()
  }, [loadOrDownloadCSV])

  const handleEdit = async (params: GridCellEditStopParams) => {
    const newRows = [...rows]
    const index = newRows.findIndex((r) => r.id === params.id)
    if (index !== -1) {
      newRows[index][params.field] = params.value
      setRows(newRows)
      setStatus('Saving...')

      const csvText = Papa.unparse(newRows.map(row => {
        const copy = { ...row }
        delete copy.id
        return copy
        }))

      await uploadToBucket(csvText)

      setStatus('All changes saved ✅')
    }
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
            onCellEditStop={handleEdit}
            autoHeight
            disableRowSelectionOnClick
            sx={{ fontSize: 14 }}
          />
        </div>
      )}
    </main>
  )
}
