export async function extractCsvFromPDF(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.statusText}`)

    const buffer = Buffer.from(await res.arrayBuffer())

    // Dynamically import only at runtime to avoid test file loading at build
    const pdfParse = (await import('pdf-parse')).default
    const data = await pdfParse(buffer)

    const match = data.text.match(/https?:\/\/[^\s"]+\.csv/)
    return match ? match[0] : null
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error(`❌ Error parsing PDF from ${url}:`, err.message)
    } else {
      console.error(`❌ Unknown error parsing PDF from ${url}`)
    }
    return null
  }
}
