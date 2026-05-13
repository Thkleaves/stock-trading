import { Router, type Request, type Response } from 'express'
import type {
  CreateOrderRequest,
  Order,
  TradeRecord,
  PositionResponse,
  TradeResponse,
} from '../types/index.js'
import { STOCKS, getStockByCode } from '../types/index.js'
import { ordersStore } from '../store/orders.js'
import { positionsStore } from '../store/positions.js'
import { tradesStore } from '../store/trades.js'
import { usersStore } from '../store/users.js'
import { matchOrder, validateBuy, validateSell } from '../engine/matcher.js'

const router = Router()

router.post(
  '/',
  (
    req: Request<object, object, CreateOrderRequest>,
    res: Response
  ) => {
    const { userId, stockCode, type, price, quantity } = req.body

    if (!userId || !stockCode || !type || price == null || quantity == null) {
      res.status(400).json({ message: '参数不完整' })
      return
    }

    const stock = getStockByCode(stockCode)
    if (!stock) {
      res.status(400).json({ message: '股票代码不存在' })
      return
    }

    const user = usersStore.getById(userId)
    if (!user) {
      res.status(400).json({ message: '用户不存在' })
      return
    }

    if (price <= 0 || quantity <= 0 || !Number.isInteger(quantity)) {
      res.status(400).json({ message: '价格或数量无效' })
      return
    }

    if (type === 'buy') {
      const err = validateBuy(price, quantity, user.balance)
      if (err) {
        res.status(400).json({ message: err })
        return
      }
    } else {
      const err = validateSell(userId, stockCode, quantity)
      if (err) {
        res.status(400).json({ message: err })
        return
      }
    }

    const order = ordersStore.create({ userId, stockCode, type, price, quantity })

    const result = matchOrder(order)

    const tradeResponses: TradeResponse[] = result.trades.map((t) =>
      toTradeResp(t, userId)
    )

    res.json({ order, trades: tradeResponses })
  }
)

router.get('/', (req: Request, res: Response) => {
  const userId = req.query.userId as string
  if (!userId) {
    res.status(400).json({ message: '缺少 userId 参数' })
    return
  }

  const orders = ordersStore.getByUser(userId)
  res.json({ orders })
})

function toTradeResp(trade: TradeRecord, userId: string): TradeResponse {
  const buyOrder = ordersStore.getById(trade.buyOrderId)
  const isBuyer = buyOrder?.userId === userId
  return {
    id: trade.id,
    stockCode: trade.stockCode,
    price: trade.price,
    quantity: trade.quantity,
    type: isBuyer ? 'buy' : 'sell',
    time: trade.time,
  }
}

export default router
