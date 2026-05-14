import express from 'express'
import cors from 'cors'
import http from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { createInitialQuotes, tick } from './market/generator.js'
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

const quotes = createInitialQuotes()

function quotesToRecord(): Record<string, StockQuote> {
  const record: Record<string, StockQuote> = {}
  for (const [code, quote] of quotes) {
    record[code] = { ...quote }
  }
  return record
}

onSubscribe((userId: string, ws: WebSocket) => {
  const quotesMsg = JSON.stringify({
    type: 'quotes',
    data: quotesToRecord(),
  })
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(quotesMsg)
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
  tick(quotes)
  for (const [code, quote] of quotes) {
    broadcastAll({
      type: 'quote',
      data: { ...quote },
    })
  }
}, 1000)

server.listen(PORT, () => {
  console.log(`[realtime] WebSocket + HTTP 服务已启动，端口 ${PORT}`)
})
