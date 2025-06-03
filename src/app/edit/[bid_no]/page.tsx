'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Papa from 'papaparse'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { DataGrid, GridColDef } from '@mui/x-data-grid'

const BUCKET = 'edited-csvs'

type Row = {
  id: number
  [key: string]: string | number
}

export default function EditCSVPage() {
  const { bid_no } = useParams() as { bid_no: string }
  const raw_bid_no = bid_no.replaceAll('-', '/')
  const safeFilename = bid_no + '.csv'
  const pdfFilename = bid_no + '.pdf'
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
    async (bucket: string, filename: string, file: string | Blob) => {
      const { error } = await supabase.storage.from(bucket).upload(filename, file, {
        contentType: typeof file === 'string' ? 'text/csv' : 'application/pdf',
        upsert: true,
      })
      if (error) throw error
    },
    []
  )

  const exportPdf = (headers: string[], data: string[][]) => {
    const doc = new jsPDF()
    autoTable(doc, {
      head: [headers],
      body: data,
    })
    return doc.output('blob')
  }

  const loadOrDownloadCSV = useCallback(async () => {
    try {
      setStatus('📁 Checking bucket...')
      const { data: existing, error } = await supabase.storage.from(BUCKET).download(safeFilename)

      let csvText: string

      if (existing) {
        csvText = await existing.text()
        setStatus('Loaded from bucket ✅')
      } else {
        const externalUrl = await fetchCsvUrlFromTable()
        const response = await fetch(`/api/fetch-csv?url=${encodeURIComponent(externalUrl)}`)
        if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`)

        const blob = await response.blob()
        csvText = await blob.text()
        setStatus('Fetched external CSV ✅')
      }

      const parsed = Papa.parse(csvText, { header: true })
      let data = parsed.data as Record<string, string>[]

      // Step 2-3: Add "Compliance" column with "YES"
      data = data.map((row) => ({ ...row, Compliance: 'YES' }))

      // Step 4: Export full CSV (with Compliance) as PDF
      const headers = Object.keys(data[0])
      const pdfData = data.map((row) => headers.map((h) => row[h] || ''))
      const pdfBlob = exportPdf(headers, pdfData)
      await uploadToBucket(BUCKET, pdfFilename, pdfBlob)

      // Step 5: Modify CSV - remove 2nd, 6th, 7th, 8th cols and add "RATE(INCL GST)"
      const reduced = data.map((row) => {
        const keys = Object.keys(row)
        const removedKeys = [keys[1], keys[5], keys[6], keys[7]]
        removedKeys.forEach((key) => delete row[key])
        row['RATE(INCL GST)'] = ''
        return row
      })

      const finalCsv = Papa.unparse(reduced)
      await uploadToBucket(BUCKET, safeFilename, finalCsv)

      const gridCols: GridColDef[] = Object.keys(reduced[0] || {}).map((field) => ({
        field,
        headerName: field,
        flex: 1,
        editable: true,
      }))

      const gridRows: Row[] = reduced.map((row, idx) => ({ id: idx, ...row }))
      setColumns(gridCols)
      setRows(gridRows)
      setStatus('Final CSV ready ✅')
      setLoading(false)
    } catch (err) {
      console.error(err)
      setStatus('❌ Failed to load/process CSV')
      setLoading(false)
    }
  }, [fetchCsvUrlFromTable, safeFilename, pdfFilename, uploadToBucket])

  useEffect(() => {
    loadOrDownloadCSV()
  }, [loadOrDownloadCSV])

  const handleRowUpdate = async (updatedRow: Row) => {
    const newRows = rows.map((r) => (r.id === updatedRow.id ? updatedRow : r))
    setRows(newRows)
    setStatus('Saving...')

    const csvText = Papa.unparse(newRows.map(({ id: _id, ...rest }) => rest))

    try {
      await uploadToBucket(BUCKET, safeFilename, csvText)
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
