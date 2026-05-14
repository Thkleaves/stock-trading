import type { Order, TradeRecord, PositionResponse, TradeResponse } from '../types/index.js'
import { getStockByCode } from '../types/index.js'
import { ordersStore } from '../store/orders.js'
import { tradesStore } from '../store/trades.js'
import { usersStore } from '../store/users.js'
import { positionsStore } from '../store/positions.js'
import { eventSeqStore } from '../store/eventSeq.js'
import { pushEvent } from '../services/eventPusher.js'

export interface MatchResult {
  trades: TradeRecord[]
  error?: string
}

export function matchOrder(newOrder: Order): MatchResult {
  const trades: TradeRecord[] = []

  const buyOrders = ordersStore.getPendingBuyOrders(newOrder.stockCode)
  const sellOrders = ordersStore.getPendingSellOrders(newOrder.stockCode)

  while (true) {
    const bestBuy = buyOrders.find(
      (o) => o.status === 'pending' || o.status === 'partial'
    )
    const bestSell = sellOrders.find(
      (o) => o.status === 'pending' || o.status === 'partial'
    )

    if (!bestBuy || !bestSell) break
    if (bestBuy.price < bestSell.price) break

    if (bestBuy.userId === bestSell.userId) {
      const newerIsBuy = bestBuy.createdAt >= bestSell.createdAt
      if (newerIsBuy) {
        const idx = buyOrders.indexOf(bestBuy)
        if (idx >= 0) buyOrders.splice(idx, 1)
      } else {
        const idx = sellOrders.indexOf(bestSell)
        if (idx >= 0) sellOrders.splice(idx, 1)
      }
      continue
    }

    const buyRemaining = bestBuy.quantity - bestBuy.filledQuantity
    const sellRemaining = bestSell.quantity - bestSell.filledQuantity
    if (buyRemaining <= 0 || sellRemaining <= 0) break

    const tradePrice = bestBuy.createdAt <= bestSell.createdAt
      ? bestBuy.price
      : bestSell.price

    const tradeQty = Math.min(buyRemaining, sellRemaining)

    const buyer = usersStore.getById(bestBuy.userId)
    const seller = usersStore.getById(bestSell.userId)
    if (!buyer || !seller) break

    usersStore.consumeFrozen(bestBuy.userId, tradePrice * tradeQty)
    seller.balance += tradePrice * tradeQty

    positionsStore.addPosition(bestBuy.userId, newOrder.stockCode, tradeQty, tradePrice)
    positionsStore.reducePosition(bestSell.userId, newOrder.stockCode, tradeQty)

    const newBuyFilled = bestBuy.filledQuantity + tradeQty
    const newSellFilled = bestSell.filledQuantity + tradeQty
    ordersStore.updateFilled(bestBuy.id, newBuyFilled)
    ordersStore.updateFilled(bestSell.id, newSellFilled)

    const trade = tradesStore.create({
      buyOrderId: bestBuy.id,
      sellOrderId: bestSell.id,
      stockCode: newOrder.stockCode,
      price: tradePrice,
      quantity: tradeQty,
    })
    trades.push(trade)

    if (bestBuy.filledQuantity >= bestBuy.quantity) {
      const idx = buyOrders.indexOf(bestBuy)
      if (idx >= 0) buyOrders.splice(idx, 1)
    }
    if (bestSell.filledQuantity >= bestSell.quantity) {
      const idx = sellOrders.indexOf(bestSell)
      if (idx >= 0) sellOrders.splice(idx, 1)
    }
  }

  const notifiedUsers = new Set<string>()
  for (const trade of trades) {
    const buyOrder = ordersStore.getById(trade.buyOrderId)
    const sellOrder = ordersStore.getById(trade.sellOrderId)
    if (buyOrder && !notifiedUsers.has(buyOrder.userId)) {
      notifiedUsers.add(buyOrder.userId)
      releaseRemainingFrozen(buyOrder, trades)
      pushEventsForUser(buyOrder.userId, trade)
    }
    if (sellOrder && !notifiedUsers.has(sellOrder.userId)) {
      notifiedUsers.add(sellOrder.userId)
      pushEventsForUser(sellOrder.userId, trade)
    }
  }

  if (newOrder.status !== 'filled' && !notifiedUsers.has(newOrder.userId)) {
    pushOrderEvent(newOrder)
  }

  return { trades }
}

function releaseRemainingFrozen(buyOrder: Order, trades: TradeRecord[]): void {
  if (buyOrder.type !== 'buy' || buyOrder.status !== 'filled') return
  let unfrozenTotal = 0
  for (const t of trades) {
    if (t.buyOrderId === buyOrder.id) {
      unfrozenTotal += t.price * t.quantity
    }
  }
  const frozenTotal = buyOrder.price * buyOrder.quantity
  const remaining = frozenTotal - unfrozenTotal
  if (remaining > 0) {
    usersStore.unfreezeBalance(buyOrder.userId, remaining)
  }
}

function pushEventsForUser(userId: string, trade: TradeRecord): void {
  const positions = positionsStore
    .getByUser(userId)
    .map(toPosResp)

  const seq = eventSeqStore.getNext(userId)

  pushEvent({
    type: 'trade',
    userId,
    eventSeq: seq,
    data: toTradeResp(trade, userId),
  })
  pushEvent({
    type: 'position',
    userId,
    eventSeq: seq,
    data: positions,
  })

  const user = usersStore.getById(userId)
  if (user) {
    pushEvent({
      type: 'user',
      userId,
      eventSeq: seq,
      data: { userId: user.id, username: user.username, balance: user.balance, frozenBalance: user.frozenBalance },
    })
  }

  const buyOrder = ordersStore.getById(trade.buyOrderId)
  const sellOrder = ordersStore.getById(trade.sellOrderId)
  if (buyOrder && buyOrder.userId === userId) {
    pushEvent({ type: 'order', userId, eventSeq: seq, data: buyOrder })
  }
  if (sellOrder && sellOrder.userId === userId) {
    pushEvent({ type: 'order', userId, eventSeq: seq, data: sellOrder })
  }
}

function pushOrderEvent(order: Order): void {
  const positions = positionsStore
    .getByUser(order.userId)
    .map(toPosResp)
  const seq = eventSeqStore.getNext(order.userId)
  pushEvent({
    type: 'order',
    userId: order.userId,
    eventSeq: seq,
    data: order,
  })
  pushEvent({
    type: 'position',
    userId: order.userId,
    eventSeq: seq,
    data: positions,
  })

  const user = usersStore.getById(order.userId)
  if (user) {
    pushEvent({
      type: 'user',
      userId: order.userId,
      eventSeq: seq,
      data: { userId: user.id, username: user.username, balance: user.balance, frozenBalance: user.frozenBalance },
    })
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

export function validateBuy(
  price: number,
  quantity: number,
  balance: number
): string | null {
  if (price * quantity > balance) return '资金不足'
  return null
}

export function validateSell(
  userId: string,
  stockCode: string,
  quantity: number
): string | null {
  const posQty = positionsStore.getQuantity(userId, stockCode)
  if (posQty < quantity) return '持仓不足'
  return null
}
