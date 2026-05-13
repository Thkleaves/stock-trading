import express from 'express'
import cors from 'cors'
import authRouter from './routes/auth.js'
import ordersRouter from './routes/orders.js'
import positionsRouter from './routes/positions.js'
import tradesRouter from './routes/trades.js'

const app = express()
const PORT = Number(process.env.PORT) || 3000

app.use(cors())
app.use(express.json())

app.use('/api/auth', authRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/positions', positionsRouter)
app.use('/api/trades', tradesRouter)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`Backend server running at http://localhost:${PORT}`)
})
