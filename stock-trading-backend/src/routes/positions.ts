import { Router, type Request, type Response } from 'express'
import type { PositionResponse } from '../types/index.js'
import { getStockByCode } from '../types/index.js'
import { positionsStore } from '../store/positions.js'

const router = Router()

router.get('/', (req: Request, res: Response) => {
  const userId = req.query.userId as string
  if (!userId) {
    res.status(400).json({ message: '缺少 userId 参数' })
    return
  }

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
