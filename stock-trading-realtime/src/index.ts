import express from 'express'
import cors from 'cors'
import http from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { STOCKS } from './market/generator.js'
import { loadAggregatedCsv, getNextQuotes, resetCsvReader, getTotalRows, getCurrentRowIndex, getHistoricalTicks } from './market/csvReader.js'
import { loadKLines, getAllDailyKLines, getAllWeeklyKLines, getAllMonthlyKLines, getDailyOhlc, getPreCloseMap } from './market/klineLoader.js'
import { setWss, configureWebSocket, broadcastAll, sendToUser, onSubscribe, onResync } from './ws/server.js'
import internalRouter from './routes/internal.js'
import type { StockQuote, Order, Position, Trade, UserInfo } from './types/index.js'

const PORT = 3001
const BACKEND_URL = 'http://localhost:3000'

const app = express()
app.use(cors())
app.use(express.json())

app.use('/internal', internalRouter)

const server = http.createServer(app)
const wss = new WebSocketServer({ server })
setWss(wss)
configureWebSocket(wss)

loadKLines()
loadAggregatedCsv()

let currentQuotes: Map<string, StockQuote> = new Map()
let currentTimestamp = ''

let dailyHighs = new Map<string, number>()
let dailyLows = new Map<string, number>()
let dailyOpens = new Map<string, number>()
const preCloseMap = getPreCloseMap()

function quotesToRecord(): Record<string, StockQuote> {
  const record: Record<string, StockQuote> = {}
  for (const [code, quote] of currentQuotes) {
    record[code] = { ...quote }
  }
  return record
}

function buildDailyOhlcRecord(): Record<string, unknown> {
  const record: Record<string, unknown> = {}
  const staticOhlc = getDailyOhlc()
  for (const item of staticOhlc) {
    record[item.code] = {
      code: item.code,
      name: item.name,
      type: item.type,
      open: dailyOpens.get(item.code) ?? item.open,
      high: dailyHighs.get(item.code) ?? item.high,
      low: dailyLows.get(item.code) ?? item.low,
      preClose: preCloseMap[item.code] ?? item.preClose,
    }
  }
  return record
}

onSubscribe((userId: string, ws: WebSocket) => {
  const quotesMsg = JSON.stringify({
    type: 'quotes',
    timestamp: currentTimestamp,
    data: quotesToRecord(),
  })
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(quotesMsg)
  }

  const indexTicks = getHistoricalTicks('000001')
  if (indexTicks.length > 0 && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'indexHistory',
      code: '000001',
      data: indexTicks,
    }))
  }
})

async function fetchBackend(path: string, userId?: string): Promise<unknown> {
  try {
    const headers: Record<string, string> = {}
    if (userId) {
      headers['X-User-ID'] = userId
    }
    const res = await fetch(`${BACKEND_URL}${path}`, { headers })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

onResync(async (userId: string, ws: WebSocket) => {
  try {
    const [ordersRes, positionsRes, tradesRes, userRes, pnlCurveRes] = await Promise.all([
      fetchBackend(`/api/orders`, userId),
      fetchBackend(`/api/positions`, userId),
      fetchBackend(`/api/trades`, userId),
      fetchBackend(`/api/auth/user`, userId),
      fetchBackend(`/api/auth/pnl-curve`, userId),
    ])

    const syncData = {
      quotes: quotesToRecord(),
      orders: (ordersRes as { orders?: Order[] } | null)?.orders ?? [],
      positions: (positionsRes as { positions?: Position[] } | null)?.positions ?? [],
      trades: (tradesRes as { trades?: Trade[] } | null)?.trades ?? [],
      user: (userRes as UserInfo | null) ?? null,
      pnlCurve: (pnlCurveRes as { date: string; value: number }[] | null) ?? [],
      klDaily: getAllDailyKLines(),
      klWeekly: getAllWeeklyKLines(),
      klMonthly: getAllMonthlyKLines(),
      dailyOhlc: buildDailyOhlcRecord(),
    }

    const syncMsg = JSON.stringify({
      type: 'sync',
      data: syncData,
    })

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(syncMsg)
    }
  } catch {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'error', data: { message: '状态同步失败' } }))
    }
  }
})

setInterval(() => {
  const result = getNextQuotes()
  if (!result) {
    console.log(`[realtime] CSV回放结束，已播放 ${getTotalRows()} 行，重新开始`)
    dailyHighs = new Map()
    dailyLows = new Map()
    dailyOpens = new Map()
    resetCsvReader()
    return
  }

  currentQuotes = result.quotes
  currentTimestamp = result.timestamp

  for (const [code, quote] of result.quotes) {
    const high = dailyHighs.get(code) ?? -Infinity
    if (quote.price > high) dailyHighs.set(code, quote.price)
    const low = dailyLows.get(code) ?? Infinity
    if (quote.price < low) dailyLows.set(code, quote.price)
    if (!dailyOpens.has(code)) {
      dailyOpens.set(code, quote.price)
    }
  }

  broadcastAll({
    type: 'quotes',
    timestamp: result.timestamp,
    data: Object.fromEntries(result.quotes),
  })
}, 1000)

server.listen(PORT, () => {
  console.log(`[realtime] WebSocket + HTTP 服务已启动，端口 ${PORT}`)
  console.log(`[realtime] 使用聚合CSV回放模式，共 ${getTotalRows()} 行数据`)
})
