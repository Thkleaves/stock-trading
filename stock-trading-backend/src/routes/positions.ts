import { Router, type Request, type Response } from 'express'
import type { PositionResponse } from '../types/index.js'
import { getStockByCode } from '../types/index.js'
import { positionsStore } from '../store/positions.js'

const router = Router()

router.get('/', (req: Request, res: Response) => {
  const userId = req.userId!
  const records = positionsStore.getByUser(userId)
  const positions: PositionResponse[] = records.map((r) => {
    const stock = getStockByCode(r.stockCode)
    return {
      stockCode: r.stockCode,
      stockName: stock?.name ?? r.stockCode,
      quantity: r.quantity,
      avgPrice: r.avgPrice,
      currentPrice: stock?.initialPrice ?? 0,
    }
  })

  res.json({ positions })
})

export default router
