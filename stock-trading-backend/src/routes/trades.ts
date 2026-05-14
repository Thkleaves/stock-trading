import { Router, type Request, type Response } from 'express'
import type { TradeResponse } from '../types/index.js'
import { tradesStore } from '../store/trades.js'
import { ordersStore } from '../store/orders.js'

const router = Router()

router.get('/', (req: Request, res: Response) => {
  const userId = req.userId!
  const records = tradesStore.getByUser(userId)
  const trades: TradeResponse[] = records.map((t) => {
    const buyOrder = ordersStore.getById(t.buyOrderId)
    const sellOrder = ordersStore.getById(t.sellOrderId)
    const isBuyer = buyOrder?.userId === userId
    const isSeller = sellOrder?.userId === userId

    let type: 'buy' | 'sell'
    if (isBuyer && isSeller) {
      const buyTime = buyOrder?.createdAt ?? 0
      const sellTime = sellOrder?.createdAt ?? 0
      type = buyTime >= sellTime ? 'buy' : 'sell'
    } else {
      type = isBuyer ? 'buy' : 'sell'
    }

    return {
      id: t.id,
      stockCode: t.stockCode,
      price: t.price,
      quantity: t.quantity,
      type,
      time: t.time,
    } as TradeResponse
  })

  res.json({ trades })
})

export default router
