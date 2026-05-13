import { Router, type Request, type Response } from 'express'
import type { TradeResponse } from '../types/index.js'
import { tradesStore } from '../store/trades.js'
import { ordersStore } from '../store/orders.js'

const router = Router()

router.get('/', (req: Request, res: Response) => {
  const userId = req.query.userId as string
  if (!userId) {
    res.status(400).json({ message: '缺少 userId 参数' })
    return
  }

  const records = tradesStore.getByUser(userId)
  const trades: TradeResponse[] = records.map((t) => {
    const buyOrder = ordersStore.getById(t.buyOrderId)
    const isBuyer = buyOrder?.userId === userId
    return {
      id: t.id,
      stockCode: t.stockCode,
      price: t.price,
      quantity: t.quantity,
      type: isBuyer ? 'buy' : 'sell',
      time: t.time,
    } as TradeResponse
  })

  res.json({ trades })
})

export default router
