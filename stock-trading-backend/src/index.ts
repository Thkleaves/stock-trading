import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { loadStocksFromCsv } from './types/index.js'
import authRouter from './routes/auth.js'
import ordersRouter from './routes/orders.js'
import positionsRouter from './routes/positions.js'
import tradesRouter from './routes/trades.js'
import { loadSnapshot, startAutoSave } from './services/snapshot.js'
import { setupSSEEndpoint } from './services/sse.js'

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

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000

loadStocksFromCsv()
loadSnapshot()
startAutoSave(5000)

app.listen(PORT, () => {
  console.log(`[server] 后台服务已启动, 端口 ${PORT}`)
})
