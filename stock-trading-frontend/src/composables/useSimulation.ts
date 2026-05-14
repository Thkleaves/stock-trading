import { ref, reactive } from 'vue'
import { parseCSV } from '@/utils/csv'

export interface TickPoint {
  time: string
  price: number
  volume: number
}

export interface StockRef {
  code: string
  name: string
  open: number
  high: number
  low: number
  preClose: number
  type: 'stock' | 'index'
}

export interface KLineRow {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface IntradayRow {
  timestamp: string
  price: number
  volume: number
  amount: number
}

interface IntradaySummaryRow {
  code: string
  name: string
  open: number
  close: number
  high: number
  low: number
  change_pct: number
  file: string
  date: string
  resolution: string
}

interface StockMasterRow {
  code: string
  name: string
  type: 'stock' | 'index'
  base_price: number
  volatility: number
  file: string
}

const DATA_BASE = '/data'

const currentTime = ref('09:30:00')
const currentDate = ref('2026-01-02')
const isRunning = ref(false)
const isLoaded = ref(false)

const stockRefs = ref<Record<string, StockRef>>({})
const currentPrices = reactive<Record<string, number>>({})
const stockTicks = reactive<Record<string, TickPoint[]>>({})

const dailyKLines = ref<Record<string, KLineRow[]>>({})
const weeklyKLines = ref<Record<string, KLineRow[]>>({})
const monthlyKLines = ref<Record<string, KLineRow[]>>({})

const indexTicks = ref<TickPoint[]>([])

const DAY_TOTAL = 14400
let timerHandle: ReturnType<typeof setInterval> | null = null

type StockIntraday = Map<number, { price: number; volume: number }>

class SimEngine {
  private stocks = new Map<string, { name: string; type: string; open: number; high: number; low: number; preClose: number; data: StockIntraday }>()
  private sec = 0

  register(code: string, name: string, type: string, open: number, high: number, low: number, preClose: number, data: StockIntraday) {
    this.stocks.set(code, { name, type, open, high, low, preClose, data })
  }

  getStocks(): string[] {
    return Array.from(this.stocks.keys())
  }

  getStockInfo(code: string) {
    const s = this.stocks.get(code)
    if (!s) return null
    return { name: s.name, type: s.type, open: s.open, high: s.high, low: s.low, preClose: s.preClose }
  }

  advance(): number | null {
    if (this.sec >= DAY_TOTAL) return null
    this.sec++
    return this.sec
  }

  reset() {
    this.sec = 0
  }

  getSecond(): number {
    return this.sec
  }

  getPriceAt(code: string, second: number): number | null {
    const s = this.stocks.get(code)
    if (!s) return null
    if (second === 0) return s.open
    const d = s.data.get(second)
    if (d) return d.price
    let prev = second - 1
    while (prev >= 0) {
      const p = s.data.get(prev)
      if (p) return p.price
      prev--
    }
    return s.open
  }

  getVolumeAt(code: string, second: number): number {
    const s = this.stocks.get(code)
    if (!s) return 0
    const d = s.data.get(second)
    return d ? d.volume : 0
  }

  getMaxSeconds(code: string): number {
    const s = this.stocks.get(code)
    if (!s) return 0
    let max = 0
    for (const k of s.data.keys()) { if (k > max) max = k }
    return max
  }
}

const engine = new SimEngine()

function secondToTime(s: number): string {
  const base = 9 * 3600 + 30 * 60
  let total = base + s
  if (s >= 7200) total += 5400
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function timeToSecond(ts: string): number {
  const [h, m, s] = ts.split(':').map(Number)
  let total = h * 3600 + m * 60 + s
  if (total >= 13 * 3600) total -= 5400
  return total - 9 * 3600 - 30 * 60
}

async function fetchText(path: string): Promise<string> {
  const resp = await fetch(`${DATA_BASE}/${path}`)
  if (!resp.ok) throw new Error(`Failed to fetch ${path}: ${resp.status}`)
  return resp.text()
}

function aggregateWeekly(daily: KLineRow[]): KLineRow[] {
  const result: KLineRow[] = []
  const grouped: KLineRow[][] = []
  let current: KLineRow[] = []
  for (const d of daily) {
    const dayOfWeek = new Date(d.date + 'T00:00:00').getDay()
    if (dayOfWeek === 1 || current.length === 0) {
      if (current.length > 0) grouped.push(current)
      current = [d]
    } else {
      current.push(d)
    }
  }
  if (current.length > 0) grouped.push(current)
  for (const week of grouped) {
    if (week.length === 0) continue
    result.push({
      date: week[0].date,
      open: week[0].open,
      close: week[week.length - 1].close,
      high: Math.max(...week.map((d) => d.high)),
      low: Math.min(...week.map((d) => d.low)),
      volume: week.reduce((s, d) => s + d.volume, 0),
    })
  }
  return result
}

function aggregateMonthly(daily: KLineRow[]): KLineRow[] {
  const result: KLineRow[] = []
  const grouped = new Map<string, KLineRow[]>()
  for (const d of daily) {
    const key = d.date.slice(0, 7)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(d)
  }
  for (const [, month] of grouped) {
    if (month.length === 0) continue
    result.push({
      date: month[0].date,
      open: month[0].open,
      close: month[month.length - 1].close,
      high: Math.max(...month.map((d) => d.high)),
      low: Math.min(...month.map((d) => d.low)),
      volume: month.reduce((s, d) => s + d.volume, 0),
    })
  }
  return result
}

async function loadAllData() {
  const masterText = await fetchText('stock_master.csv')
  const masterRows = parseCSV<Record<string, string | number>>(masterText, ['base_price', 'volatility'])

  const summaryText = await fetchText('intraday_summary.csv')
  const summaryRows = parseCSV<Record<string, string | number>>(summaryText, ['open', 'close', 'high', 'low', 'change_pct'])

  const summaryMap = new Map<string, IntradaySummaryRow>()
  for (const r of summaryRows) {
    const row = r as unknown as IntradaySummaryRow
    summaryMap.set(row.code, row)
  }

  const stocksToLoad: Array<{ code: string; name: string; type: 'stock' | 'index' }> = []
  for (const r of masterRows) {
    const row = r as unknown as StockMasterRow
    if (row.type !== 'stock') continue
    stocksToLoad.push({ code: row.code, name: row.name, type: 'stock' })
  }

  const intradayPromises = stocksToLoad.map(async (stock) => {
    const summary = summaryMap.get(stock.code)
    const filePath = summary ? summary.file.replace('intraday/', '') : `${stock.code}_${stock.name}_intraday.csv`
    try {
      const text = await fetchText(`intraday/${filePath}`)
      const rows = parseCSV<Record<string, string | number>>(text, ['price', 'volume', 'amount'])
      const data: StockIntraday = new Map()
      for (const r of rows) {
        const row = r as unknown as IntradayRow
        const ts = row.timestamp.split(' ')[1]
        const sec = timeToSecond(ts)
        data.set(sec, { price: row.price, volume: row.volume })
      }
      const info = summary || { open: data.get(0)?.price || 0, high: 0, low: Infinity, close: 0, code: stock.code, name: stock.name }
      const open = data.get(0)?.price || info.open || 0
      let high = 0
      let low = Infinity
      for (const [, v] of data) {
        if (v.price > high) high = v.price
        if (v.price < low) low = v.price
      }
      const lastSec = Math.max(...Array.from(data.keys()))
      const preClose = data.get(lastSec)?.price || open

      engine.register(stock.code, stock.name, stock.type, open, high || open, low === Infinity ? open : low, preClose, data)

      stockRefs.value[stock.code] = {
        code: stock.code,
        name: stock.name,
        open,
        high: high || open,
        low: low === Infinity ? open : low,
        preClose,
        type: 'stock',
      }
      currentPrices[stock.code] = open
      stockTicks[stock.code] = []
    } catch {
      console.warn(`Failed to load intraday for ${stock.code} ${stock.name}`)
    }
  })

  await Promise.all(intradayPromises)

  const nonStockRows = (masterRows as unknown as StockMasterRow[]).filter(
    (r) => r.type === 'index'
  )
  const klinePromises = nonStockRows.map(async (row) => {
    try {
      const text = await fetchText(row.file)
      const dl = parseCSV<Record<string, string | number>>(text, ['open', 'high', 'low', 'close', 'volume', 'amount'])
      const kLines: KLineRow[] = dl.map((d) => ({
        date: d.date as string,
        open: d.open as number,
        high: d.high as number,
        low: d.low as number,
        close: d.close as number,
        volume: d.volume as number,
      }))
      const code = row.code
      dailyKLines.value[code] = kLines
      weeklyKLines.value[code] = aggregateWeekly(kLines)
      monthlyKLines.value[code] = aggregateMonthly(kLines)

      const latest = kLines[kLines.length - 1]
      const prev = kLines[kLines.length - 2]
      stockRefs.value[code] = {
        code,
        name: row.name,
        open: latest.open,
        high: latest.high,
        low: latest.low,
        preClose: prev.close,
        type: 'index',
      }
      const indexPrice = kLines[kLines.length - 1]?.close || latest.close
      currentPrices[code] = indexPrice
    } catch {
      console.warn(`Failed to load K-line for ${row.code}`)
    }
  })

  const stockKlinePromises = (masterRows as unknown as StockMasterRow[]).filter(
    (r) => r.type === 'stock'
  ).map(async (row) => {
    try {
      const text = await fetchText(row.file)
      const dl = parseCSV<Record<string, string | number>>(text, ['open', 'high', 'low', 'close', 'volume', 'amount'])
      const kLines: KLineRow[] = dl.map((d) => ({
        date: d.date as string,
        open: d.open as number,
        high: d.high as number,
        low: d.low as number,
        close: d.close as number,
        volume: d.volume as number,
      }))
      dailyKLines.value[row.code] = kLines
      weeklyKLines.value[row.code] = aggregateWeekly(kLines)
      monthlyKLines.value[row.code] = aggregateMonthly(kLines)
    } catch {
      console.warn(`Failed to load K-line for ${row.code}`)
    }
  })

  await Promise.all([...klinePromises, ...stockKlinePromises])

  isLoaded.value = true
}

function tick() {
  const sec = engine.advance()
  if (sec === null) {
    stop()
    return
  }
  currentTime.value = secondToTime(sec)

  const stockCodes = engine.getStocks()
  for (const code of stockCodes) {
    const price = engine.getPriceAt(code, sec)
    if (price !== null) {
      currentPrices[code] = price
    }
    const vol = engine.getVolumeAt(code, sec)
    const p = engine.getPriceAt(code, sec) || currentPrices[code]
    stockTicks[code].push({
      time: secondToTime(sec),
      price: p,
      volume: vol,
    })
  }

  const idxPrice = computeIndexPrice()
  if (idxPrice !== null) {
    currentPrices['000001'] = idxPrice
    indexTicks.value.push({
      time: secondToTime(sec),
      price: idxPrice,
      volume: 0,
    })
  }
}

function computeIndexPrice(): number | null {
  const codes = engine.getStocks()
  if (codes.length === 0) return null
  let sum = 0
  let count = 0
  for (const code of codes) {
    const p = currentPrices[code]
    if (p != null && p > 0) {
      sum += p
      count++
    }
  }
  return count > 0 ? +(sum / count).toFixed(2) : null
}

function start() {
  if (timerHandle) return
  isRunning.value = true
  timerHandle = setInterval(tick, 1000)
}

function stop() {
  if (timerHandle) {
    clearInterval(timerHandle)
    timerHandle = null
  }
  isRunning.value = false
}

function resetAndStart() {
  stop()
  engine.reset()
  currentTime.value = '09:30:00'
  for (const code of engine.getStocks()) {
    stockTicks[code] = []
    const info = engine.getStockInfo(code)
    if (info) {
      currentPrices[code] = info.open
    }
  }
  indexTicks.value = []
  start()
}

const SIM_STATE_KEY = 'trading_sim_state'

let initPromise: Promise<void> | null = null

function fastForward(sec: number) {
  for (let i = 0; i < sec; i++) {
    const s = engine.advance()
    if (s === null) break
    const stockCodes = engine.getStocks()
    for (const code of stockCodes) {
      const price = engine.getPriceAt(code, s)
      if (price !== null) {
        currentPrices[code] = price
      }
      const vol = engine.getVolumeAt(code, s)
      const p = price || currentPrices[code]
      stockTicks[code].push({
        time: secondToTime(s),
        price: p,
        volume: vol,
      })
    }
    const idxPrice = computeIndexPrice()
    if (idxPrice !== null) {
      currentPrices['000001'] = idxPrice
      indexTicks.value.push({
        time: secondToTime(s),
        price: idxPrice,
        volume: 0,
      })
    }
  }
  currentTime.value = secondToTime(engine.getCurrentSecond())
}

function init() {
  if (initPromise) return initPromise
  initPromise = loadAllData().then(() => {
    const saved = localStorage.getItem(SIM_STATE_KEY)
    if (saved) {
      try {
        const state = JSON.parse(saved) as { startTs: number }
        const elapsed = Math.floor((Date.now() - state.startTs) / 1000)
        const targetSec = Math.min(elapsed, DAY_TOTAL)
        if (targetSec > 0) {
          fastForward(targetSec)
        }
        if (targetSec < DAY_TOTAL) {
          start()
        } else {
          currentTime.value = secondToTime(DAY_TOTAL)
        }
      } catch {
        localStorage.removeItem(SIM_STATE_KEY)
        start()
      }
    } else {
      localStorage.setItem(SIM_STATE_KEY, JSON.stringify({ startTs: Date.now() }))
      start()
    }
  })
  return initPromise
}

init()

export function useSimulation() {
  return {
    currentTime,
    currentDate,
    isRunning,
    isLoaded,
    stockRefs,
    currentPrices,
    stockTicks,
    indexTicks,
    dailyKLines,
    weeklyKLines,
    monthlyKLines,
    start,
    stop,
    resetAndStart,
  }
}
