export function parseCSV<T extends Record<string, string | number>>(
  text: string,
  numericFields: string[]
): T[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map((h) => h.trim())
  const result: T[] = []

  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',')
    if (vals.length < headers.length) continue
    const row: Record<string, string | number> = {}
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j]
      const val = vals[j].trim()
      row[key] = numericFields.includes(key) ? Number(val) : val
    }
    result.push(row as T)
  }
  return result
}
