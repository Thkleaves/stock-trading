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
import { pushEvent } from '../services/sse.js'
import { eventSeqStore } from '../store/eventSeq.js'

const router = Router()

router.post(
  '/',
  (
    req: Request<object, object, CreateOrderRequest>,
    res: Response
  ) => {
    const userId = req.userId!
    const { stockCode, type, price, quantity } = req.body

    if (!stockCode || !type || price == null || quantity == null) {
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
      usersStore.freezeBalance(userId, price * quantity)
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

router.put(
  '/:id/cancel',
  (req: Request<{ id: string }>, res: Response) => {
    const userId = req.userId!
    const orderId = req.params.id

    const order = ordersStore.getById(orderId)
    if (!order) {
      res.status(404).json({ message: '委托不存在' })
      return
    }
    if (order.userId !== userId) {
      res.status(403).json({ message: '无权操作' })
      return
    }
    if (order.status === 'filled') {
      res.status(400).json({ message: '已成交委托无法撤单' })
      return
    }
    if (order.status === 'cancelled') {
      res.status(400).json({ message: '该委托已撤单' })
      return
    }

    ordersStore.setCancelled(orderId)

    if (order.type === 'buy') {
      const unfilledQuantity = order.quantity - order.filledQuantity
      const refund = order.price * unfilledQuantity
      usersStore.unfreezeBalance(userId, refund)
    }

    pushUserUpdate(userId)

    res.json({ order: ordersStore.getById(orderId) })
  }
)

router.get('/', (req: Request, res: Response) => {
  const userId = req.userId!
  const orders = ordersStore.getByUser(userId)
  res.json({ orders })
})

function pushUserUpdate(userId: string): void {
  const positions = positionsStore
    .getByUser(userId)
    .map(toPosResp)
  const orders = ordersStore.getByUser(userId)
  const seq = eventSeqStore.getNext(userId)

  const user = usersStore.getById(userId)
  if (user) {
    pushEvent({
      type: 'user',
      userId,
      eventSeq: seq,
      data: { userId: user.id, username: user.username, balance: user.balance, frozenBalance: user.frozenBalance },
    })
  }

  for (const o of orders) {
    pushEvent({ type: 'order', userId, eventSeq: seq, data: o })
  }

  pushEvent({ type: 'position', userId, eventSeq: seq, data: positions })
 }

function toTradeResp(trade: TradeRecord, userId: string): TradeResponse {
  const buyOrder = ordersStore.getById(trade.buyOrderId)
  const sellOrder = ordersStore.getById(trade.sellOrderId)
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
    id: trade.id,
    stockCode: trade.stockCode,
    price: trade.price,
    quantity: trade.quantity,
    type,
    time: trade.time,
  }
}

function toPosResp(r: {
  userId: string
  stockCode: string
  quantity: number
  avgPrice: number
}): PositionResponse {
  const stock = getStockByCode(r.stockCode)
  return {
    stockCode: r.stockCode,
    stockName: stock?.name ?? r.stockCode,
    quantity: r.quantity,
    avgPrice: r.avgPrice,
    currentPrice: stock?.initialPrice ?? 0,
  }
}

export default router
