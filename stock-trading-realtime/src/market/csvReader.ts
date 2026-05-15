import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { StockQuote } from '../types/index.js'
import { STOCKS } from './generator.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CSV_PATH = join(__dirname, '..', '..', 'data', 'intraday_aggregated.csv')

export interface AggregatedRow {
  timestamp: string
  prices: Map<string, number>
}

let rows: AggregatedRow[] = []
let rowIndex = 0
let prevPrices: Map<string, number> | null = null

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

export function loadAggregatedCsv(): void {
  const raw = readFileSync(CSV_PATH, 'utf-8')
  const lines = raw.trim().split('\n')
  if (lines.length < 2) {
    throw new Error('聚合CSV文件为空或只有表头')
  }

  const header = lines[0].split(',')
  const codeColumns = header.slice(1)

  const parsed: AggregatedRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    if (cols.length < header.length) continue
    const timestamp = cols[0].trim()
    const prices = new Map<string, number>()
    for (let j = 0; j < codeColumns.length; j++) {
      const code = codeColumns[j].trim()
      const price = parseFloat(cols[j + 1])
      if (!isNaN(price)) {
        prices.set(code, price)
      }
    }
    parsed.push({ timestamp, prices })
  }

  rows = parsed
  rowIndex = 0
  prevPrices = null
  console.log(`[csvReader] 已加载聚合CSV: ${rows.length} 行, ${codeColumns.length} 个标的`)
}

export function getNextQuotes(): { timestamp: string; quotes: Map<string, StockQuote> } | null {
  if (rowIndex >= rows.length) return null

  const row = rows[rowIndex]
  rowIndex++

  const quotes = new Map<string, StockQuote>()

  for (const stock of STOCKS) {
    const price = row.prices.get(stock.code)
    if (price === undefined) continue

    let change = 0
    let changePercent = 0

    if (prevPrices) {
      const prev = prevPrices.get(stock.code)
      if (prev !== undefined && prev !== 0) {
        change = round(price - prev, 2)
        changePercent = round(((price - prev) / prev) * 100, 2)
      }
    }

    quotes.set(stock.code, {
      code: stock.code,
      name: stock.name,
      price,
      change,
      changePercent,
    })
  }

  const nextPrices = new Map<string, number>()
  for (const [code, price] of row.prices) {
    nextPrices.set(code, price)
  }
  prevPrices = nextPrices

  return { timestamp: row.timestamp, quotes }
}

export function resetCsvReader(): void {
  rowIndex = 0
  prevPrices = null
}

export function getTotalRows(): number {
  return rows.length
}

export interface HistoricalTick {
  time: string
  price: number
}

export function getHistoricalTicks(code: string): HistoricalTick[] {
  const ticks: HistoricalTick[] = []
  for (let i = 0; i < rowIndex; i++) {
    const row = rows[i]
    const price = row.prices.get(code)
    if (price !== undefined) {
      const ts = row.timestamp
      const timePart = ts.includes(' ') ? ts.split(' ')[1] : ts
      ticks.push({ time: timePart, price })
    }
  }
  return ticks
}

export function getCurrentRowIndex(): number {
  return rowIndex
}
