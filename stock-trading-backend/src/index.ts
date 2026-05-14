import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { authMiddleware } from './middleware/auth.js'
import authRouter from './routes/auth.js'
import ordersRouter from './routes/orders.js'
import positionsRouter from './routes/positions.js'
import tradesRouter from './routes/trades.js'
import { loadSnapshot, startAutoSave } from './services/snapshot.js'

const app = express()
const PORT = Number(process.env.PORT) || 3000

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())
app.use(cookieParser())

app.use('/api/auth', authRouter)
app.use('/api/orders', authMiddleware, ordersRouter)
app.use('/api/positions', authMiddleware, positionsRouter)
app.use('/api/trades', authMiddleware, tradesRouter)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

loadSnapshot()
startAutoSave()

app.listen(PORT, () => {
  console.log(`Backend server running at http://localhost:${PORT}`)
})
