import type { Order, TradeRecord, TradeResponse, RealtimeEvent } from '../types/index.js'
import { getStockByCode } from '../types/index.js'
import { ordersStore } from '../store/orders.js'
import { tradesStore } from '../store/trades.js'
import { positionsStore } from '../store/positions.js'
import { usersStore } from '../store/users.js'
import { pnlCurveStore } from '../store/pnlCurve.js'
import { pushEvents } from '../services/eventPusher.js'

export function validateBuy(
  price: number,
  quantity: number,
  balance: number
): string | null {
  if (price <= 0) return '价格无效'
  if (quantity <= 0 || !Number.isInteger(quantity)) return '数量无效'
  if (price * quantity > balance) return '资金不足'
  return null
}

export function validateSell(
  userId: string,
  stockCode: string,
  quantity: number
): string | null {
  if (quantity <= 0 || !Number.isInteger(quantity)) return '数量无效'
  const pos = positionsStore.getOne(userId, stockCode)
  if (!pos || pos.quantity < quantity) return '持仓不足'
  return null
}

type MatchResult = {
  trades: TradeRecord[]
  error?: string
}

function computeUserPnl(userId: string): number {
  const user = usersStore.getById(userId)
  if (!user) return 0
  const positions = positionsStore.getByUser(userId)
  let positionValue = 0
  for (const pos of positions) {
    const stock = getStockByCode(pos.stockCode)
    positionValue += pos.quantity * (stock?.initialPrice ?? pos.avgPrice)
  }
  const initialAsset = pnlCurveStore.getInitialAssets(userId)
  if (initialAsset === 0) return 0
  return user.balance + user.frozenBalance + positionValue - initialAsset
}

function updatePnlForUser(userId: string): void {
  if (pnlCurveStore.getByUserId(userId).length === 0) return
  const pnl = computeUserPnl(userId)
  pnlCurveStore.appendEntry(userId, pnl)
}

export function matchOrder(newOrder: Order): MatchResult {
  const stockCode = newOrder.stockCode

  const rawBuys = ordersStore.getPendingBuyOrders(stockCode)
  const rawSells = ordersStore.getPendingSellOrders(stockCode)

  const remainingBuys: Order[] = [...rawBuys]
  const remainingSells: Order[] = [...rawSells]

  const newTrades: TradeRecord[] = []

  while (true) {
    if (remainingBuys.length === 0 || remainingSells.length === 0) break

    const bestBuy = remainingBuys[0]
    const bestSell = remainingSells[0]

    if (bestBuy.price < bestSell.price) break

    if (bestBuy.userId === bestSell.userId) {
      if (bestBuy.createdAt <= bestSell.createdAt) {
        remainingBuys.shift()
      } else {
        remainingSells.shift()
      }
      continue
    }

    const buyer = usersStore.getById(bestBuy.userId)
    const seller = usersStore.getById(bestSell.userId)
    if (!buyer || !seller) break

    const tradePrice =
      bestBuy.createdAt <= bestSell.createdAt ? bestBuy.price : bestSell.price
    const buyRemaining = bestBuy.quantity - bestBuy.filledQuantity
    const sellRemaining = bestSell.quantity - bestSell.filledQuantity
    const tradeQty = Math.min(buyRemaining, sellRemaining)
    if (tradeQty <= 0) break

    const tradeCost = tradePrice * tradeQty
    usersStore.consumeFrozen(bestBuy.userId, tradeCost)
    const priceDiff = (bestBuy.price - tradePrice) * tradeQty
    if (priceDiff > 0) {
      buyer.balance += priceDiff
      buyer.frozenBalance -= priceDiff
    }
    seller.balance += tradeCost

    positionsStore.addPosition(bestBuy.userId, stockCode, tradeQty, tradePrice)
    positionsStore.reducePosition(bestSell.userId, stockCode, tradeQty)

    const updatedBuy = ordersStore.updateFilled(bestBuy.id, bestBuy.filledQuantity + tradeQty)
    const updatedSell = ordersStore.updateFilled(bestSell.id, bestSell.filledQuantity + tradeQty)

    const trade = tradesStore.create({
      buyOrderId: bestBuy.id,
      sellOrderId: bestSell.id,
      stockCode,
      price: tradePrice,
      quantity: tradeQty,
    })
    newTrades.push(trade)

    if (updatedBuy?.status === 'filled') {
      remainingBuys.shift()
    }
    if (updatedSell?.status === 'filled') {
      remainingSells.shift()
    }

    pushEvents([
      {
        type: 'trade',
        userId: bestBuy.userId,
        eventSeq: Date.now(),
        data: {
          id: trade.id,
          stockCode,
          price: tradePrice,
          quantity: tradeQty,
          type: 'buy',
          time: trade.time,
        },
      },
      {
        type: 'trade',
        userId: bestSell.userId,
        eventSeq: Date.now(),
        data: {
          id: trade.id,
          stockCode,
          price: tradePrice,
          quantity: tradeQty,
          type: 'sell',
          time: trade.time,
        },
      },
    ])
  }

  const affectedUsers = new Set<string>()
  for (const t of newTrades) {
    const bOrder = ordersStore.getById(t.buyOrderId)
    const sOrder = ordersStore.getById(t.sellOrderId)
    if (bOrder) affectedUsers.add(bOrder.userId)
    if (sOrder) affectedUsers.add(sOrder.userId)
  }

  for (const userId of affectedUsers) {
    updatePnlForUser(userId)

    const user = usersStore.getById(userId)
    const positions = positionsStore.getByUser(userId)
    const orders = ordersStore.getByUser(userId)

    const events: RealtimeEvent[] = []

    for (const o of orders) {
      events.push({
        type: 'order',
        userId,
        eventSeq: Date.now(),
        data: o,
      })
    }

    events.push({
      type: 'position',
      userId,
      eventSeq: Date.now(),
      data: positions.map((p) => ({
        stockCode: p.stockCode,
        stockName: getStockByCode(p.stockCode)?.name ?? p.stockCode,
        quantity: p.quantity,
        avgPrice: p.avgPrice,
        currentPrice: getStockByCode(p.stockCode)?.initialPrice ?? p.avgPrice,
      })),
    })

    events.push({
      type: 'user',
      userId,
      eventSeq: Date.now(),
      data: {
        userId: user!.id,
        username: user!.username,
        balance: user!.balance,
        frozenBalance: user!.frozenBalance,
      },
    })

    pushEvents(events)
  }

  return { trades: newTrades }
}
