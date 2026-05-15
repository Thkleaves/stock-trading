import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const BACKEND_DATA = resolve(__dirname, '..', '..', '..', 'stock-trading-backend', 'data')
const STOCKS_DIR = resolve(BACKEND_DATA, 'stocks')
const INDICES_DIR = resolve(BACKEND_DATA, 'indices')
const MASTER_CSV = resolve(BACKEND_DATA, 'stock_master.csv')

export interface KLineRow {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface DailyOhlc {
  code: string
  name: string
  type: 'stock' | 'index'
  open: number
  high: number
  low: number
  preClose: number
}

export interface StockDef {
  code: string
  name: string
  type: 'stock' | 'index'
}

let stockDefs: StockDef[] = []
let dailyKLines: Record<string, KLineRow[]> = {}
let weeklyKLines: Record<string, KLineRow[]> = {}
let monthlyKLines: Record<string, KLineRow[]> = {}
let preCloseMap: Record<string, number> = {}
let dailyOhlc: DailyOhlc[] = []

function parseStockMaster(): StockDef[] {
  if (!existsSync(MASTER_CSV)) {
    console.warn(`[klineLoader] stock_master.csv 不存在: ${MASTER_CSV}`)
    return []
  }
  const raw = readFileSync(MASTER_CSV, 'utf-8')
  const lines = raw.trim().split('\n')
  if (lines.length < 2) return []

  const defs: StockDef[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    if (cols.length < 3) continue
    defs.push({
      code: cols[0].trim(),
      name: cols[1].trim(),
      type: cols[2].trim() as 'stock' | 'index',
    })
  }
  return defs
}

function readKLinesFromCsv(filePath: string): KLineRow[] {
  if (!existsSync(filePath)) {
    console.warn(`[klineLoader] K线文件不存在: ${filePath}`)
    return []
  }
  const raw = readFileSync(filePath, 'utf-8')
  const lines = raw.trim().split('\n')
  if (lines.length < 2) return []

  const rows: KLineRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    if (cols.length < 6) continue
    rows.push({
      date: cols[0].trim(),
      open: parseFloat(cols[1]),
      close: parseFloat(cols[2]),
      high: parseFloat(cols[3]),
      low: parseFloat(cols[4]),
      volume: parseFloat(cols[5]),
    })
  }
  return rows
}

function aggregateWeekly(daily: KLineRow[]): KLineRow[] {
  const result: KLineRow[] = []
  let week: KLineRow[] = []

  for (const d of daily) {
    const dayOfWeek = new Date(d.date + 'T00:00:00').getDay()
    if (dayOfWeek === 1 || week.length === 0) {
      if (week.length > 0) result.push(buildAggregate(week))
      week = [d]
    } else {
      week.push(d)
    }
  }
  if (week.length > 0) result.push(buildAggregate(week))
  return result
}

function aggregateMonthly(daily: KLineRow[]): KLineRow[] {
  const result: KLineRow[] = []
  const groups = new Map<string, KLineRow[]>()
  for (const d of daily) {
    const key = d.date.slice(0, 7)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(d)
  }
  for (const [, month] of groups) {
    if (month.length > 0) result.push(buildAggregate(month))
  }
  return result
}

function buildAggregate(bars: KLineRow[]): KLineRow {
  const highs = bars.map((d) => d.high)
  const lows = bars.map((d) => d.low)
  return {
    date: bars[0].date,
    open: bars[0].open,
    close: bars[bars.length - 1].close,
    high: Math.max(...highs),
    low: Math.min(...lows),
    volume: bars.reduce((s, d) => s + d.volume, 0),
  }
}

function loadDailyKLines(defs: StockDef[]): void {
  const result: Record<string, KLineRow[]> = {}

  for (const def of defs) {
    const dir = def.type === 'index' ? INDICES_DIR : STOCKS_DIR
    const filePath = resolve(dir, `${def.code}_${def.name}.csv`)
    const klines = readKLinesFromCsv(filePath)
    if (klines.length > 0) {
      result[def.code] = klines
    }
  }

  dailyKLines = result
}

function buildWeeklyAndMonthly(): void {
  const wResult: Record<string, KLineRow[]> = {}
  const mResult: Record<string, KLineRow[]> = {}

  for (const [code, daily] of Object.entries(dailyKLines)) {
    wResult[code] = aggregateWeekly(daily)
    mResult[code] = aggregateMonthly(daily)
  }

  weeklyKLines = wResult
  monthlyKLines = mResult
}

function buildPreCloseMap(): void {
  const map: Record<string, number> = {}
  for (const [code, daily] of Object.entries(dailyKLines)) {
    if (daily.length > 0) {
      map[code] = daily[daily.length - 1].close
    }
  }
  preCloseMap = map
}

function buildDailyOhlc(defs: StockDef[]): void {
  const list: DailyOhlc[] = []
  for (const def of defs) {
    const daily = dailyKLines[def.code]
    const preClose = preCloseMap[def.code] ?? 0
    if (daily && daily.length > 0) {
      const last = daily[daily.length - 1]
      list.push({
        code: def.code,
        name: def.name,
        type: def.type,
        open: last.open,
        high: last.high,
        low: last.low,
        preClose,
      })
    } else {
      list.push({
        code: def.code,
        name: def.name,
        type: def.type,
        open: preClose,
        high: preClose,
        low: preClose,
        preClose,
      })
    }
  }
  dailyOhlc = list
}

export function loadKLines(): void {
  stockDefs = parseStockMaster()
  console.log(`[klineLoader] 从 stock_master.csv 加载 ${stockDefs.length} 个标的定义`)

  loadDailyKLines(stockDefs)
  console.log(`[klineLoader] 加载 ${Object.keys(dailyKLines).length} 个标的日K线`)

  buildWeeklyAndMonthly()
  buildPreCloseMap()
  buildDailyOhlc(stockDefs)
  console.log(`[klineLoader] 已聚合周K/月K/昨收价，${dailyOhlc.length} 个标的OHLC就绪`)
}

export function getStockDefs(): StockDef[] {
  return stockDefs
}

export function getAllDailyKLines(): Record<string, KLineRow[]> {
  return dailyKLines
}

export function getAllWeeklyKLines(): Record<string, KLineRow[]> {
  return weeklyKLines
}

export function getAllMonthlyKLines(): Record<string, KLineRow[]> {
  return monthlyKLines
}

export function getPreCloseMap(): Record<string, number> {
  return preCloseMap
}

export function getDailyOhlc(): DailyOhlc[] {
  return dailyOhlc
}
