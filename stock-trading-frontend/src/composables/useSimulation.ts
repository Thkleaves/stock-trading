import { ref, reactive } from 'vue'
import { useMarketStore } from '@/stores/market'

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

const currentTime = ref('')
const currentDate = ref('')
const isRunning = ref(false)
const isLoaded = ref(false)

const stockRefs = ref<Record<string, StockRef>>({})
const currentPrices = reactive<Record<string, number>>({})
const stockTicks = reactive<Record<string, TickPoint[]>>({})

const dailyKLines = ref<Record<string, KLineRow[]>>({})
const weeklyKLines = ref<Record<string, KLineRow[]>>({})
const monthlyKLines = ref<Record<string, KLineRow[]>>({})

const indexTicks = ref<TickPoint[]>([])

let timerHandle: ReturnType<typeof setInterval> | null = null

function tickFromWebSocket() {
  const now = new Date()
  currentTime.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
  currentDate.value = now.toISOString().split('T')[0]

  const marketStore = useMarketStore()
  for (const [code, quote] of Object.entries(marketStore.quotes)) {
    if (!stockRefs.value[code]) {
      const isIndex = code === '000001' || code === '399001' || code === '399006'
      stockRefs.value[code] = {
        code,
        name: quote.name,
        open: quote.price,
        high: quote.price,
        low: quote.price,
        preClose: quote.price,
        type: isIndex ? 'index' : 'stock',
      }
    }

    const prevPrice = currentPrices[code]
    currentPrices[code] = quote.price

    const ref = stockRefs.value[code]
    if (quote.price > ref.high) ref.high = quote.price
    if (quote.price < ref.low) ref.low = quote.price

    if (prevPrice !== undefined && prevPrice !== quote.price) {
      if (ref.type === 'stock') {
        if (!stockTicks[code]) stockTicks[code] = []
        stockTicks[code].push({
          time: currentTime.value,
          price: quote.price,
          volume: 0,
        })
      } else {
        indexTicks.value.push({
          time: currentTime.value,
          price: quote.price,
          volume: 0,
        })
      }
    }
  }
}

function tick() {
  tickFromWebSocket()
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

  const now = new Date()
  currentTime.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
  currentDate.value = now.toISOString().split('T')[0]

  for (const code of Object.keys(stockTicks)) {
    stockTicks[code] = []
  }
  indexTicks.value = []
  start()
}

function init() {
  const now = new Date()
  currentTime.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
  currentDate.value = now.toISOString().split('T')[0]
  start()
}

init()

export function setKLines(
  klDaily: Record<string, KLineRow[]>,
  klWeekly: Record<string, KLineRow[]>,
  klMonthly: Record<string, KLineRow[]>
) {
  dailyKLines.value = klDaily
  weeklyKLines.value = klWeekly
  monthlyKLines.value = klMonthly
  if (!isLoaded.value) {
    isLoaded.value = true
  }
}

export function setStockRefs(dailyOhlc: Record<string, { code: string; name: string; open: number; high: number; low: number; preClose: number; type: 'stock' | 'index' }>) {
  for (const [code, item] of Object.entries(dailyOhlc)) {
    stockRefs.value[code] = {
      code: item.code,
      name: item.name,
      open: item.open,
      high: item.high,
      low: item.low,
      preClose: item.preClose,
      type: item.type,
    }
  }
  if (!isLoaded.value && Object.keys(stockRefs.value).length > 0) {
    isLoaded.value = true
  }
}

export function setDailyOhlc(_dailyOhlc: Record<string, unknown>) {
  // 占位，后续若需缓存日内OHLC可在此扩展
}

export function prependIndexTicks(ticks: TickPoint[]) {
  indexTicks.value = [...ticks, ...indexTicks.value]
}

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
