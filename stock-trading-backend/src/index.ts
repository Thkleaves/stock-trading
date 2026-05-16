import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { loadStocksFromCsv, INITIAL_BALANCE, INITIAL_STOCK_SHARES, INITIAL_STOCK_COUNT, STOCKS, getStockByCode } from './types/index.js'
import authRouter from './routes/auth.js'
import ordersRouter from './routes/orders.js'
import positionsRouter from './routes/positions.js'
import tradesRouter from './routes/trades.js'
import { loadSnapshot, startAutoSave } from './services/snapshot.js'
import { setupSSEEndpoint } from './services/sse.js'
import { usersStore } from './store/users.js'
import { ordersStore } from './store/orders.js'
import { positionsStore } from './store/positions.js'
import { tradesStore } from './store/trades.js'
import { pnlCurveStore } from './store/pnlCurve.js'
import { eventSeqStore } from './store/eventSeq.js'
import { existsSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SNAPSHOT_PATH = join(__dirname, '..', 'data', 'snapshot.json')

const app = express()

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())
app.use(cookieParser())

app.use((req, _res, next) => {
  const userId = req.cookies?.userId as string | undefined
    ?? req.headers['x-user-id'] as string | undefined
  ;(req as unknown as Record<string, unknown>).userId = userId
  next()
})

app.use('/api/auth', authRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/positions', positionsRouter)
app.use('/api/trades', tradesRouter)
app.get('/api/events', setupSSEEndpoint())

app.post('/api/reset', (_req, res) => {
  console.log('[server] 收到重置请求，恢复到初始状态')

  const allUsers = usersStore.getAll()

  for (const user of allUsers) {
    user.balance = INITIAL_BALANCE
    user.frozenBalance = 0
  }

  ordersStore.clear()
  tradesStore.clear()
  eventSeqStore.reset()

  positionsStore.clear()
  pnlCurveStore.clear()

  for (const user of allUsers) {
    let stockCodes = user.initialStockCodes
    if (!stockCodes || stockCodes.length === 0) {
      stockCodes = STOCKS.slice(0, INITIAL_STOCK_COUNT).map((s) => s.code)
      user.initialStockCodes = stockCodes
      console.log(`[server] 用户 ${user.username} 缺少初始股票记录，已自动分配`)
    }
    for (const code of stockCodes) {
      const stock = getStockByCode(code)
      if (stock) {
        positionsStore.addPosition(user.id, code, INITIAL_STOCK_SHARES, stock.initialPrice)
      }
    }
    pnlCurveStore.generateForUser(user.id, stockCodes)
  }

  if (existsSync(SNAPSHOT_PATH)) {
    try {
      unlinkSync(SNAPSHOT_PATH)
      console.log('[server] 已删除快照文件')
    } catch {
      console.error('[server] 删除快照文件失败')
    }
  }

  console.log(`[server] 所有交易数据已恢复初始状态，共 ${allUsers.length} 个用户`)
  res.json({ ok: true })
})

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000

loadStocksFromCsv()
loadSnapshot()
startAutoSave(5000)

app.listen(PORT, () => {
  console.log(`[server] 后台服务已启动, 端口 ${PORT}`)
})
