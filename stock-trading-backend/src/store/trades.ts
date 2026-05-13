import { v4 as uuid } from 'uuid'
import type { TradeRecord } from '../types/index.js'
import { ordersStore } from './orders.js'

const trades: TradeRecord[] = []

export const tradesStore = {
  create(params: {
    buyOrderId: string
    sellOrderId: string
    stockCode: string
    price: number
    quantity: number
  }): TradeRecord {
    const trade: TradeRecord = {
      id: uuid(),
      buyOrderId: params.buyOrderId,
      sellOrderId: params.sellOrderId,
      stockCode: params.stockCode,
      price: params.price,
      quantity: params.quantity,
      time: Date.now(),
    }
    trades.push(trade)
    return trade
  },

  getByUser(userId: string, limit = 50): TradeRecord[] {
    const result: TradeRecord[] = []
    for (const trade of trades) {
      const buyOrder = ordersStore.getById(trade.buyOrderId)
      const sellOrder = ordersStore.getById(trade.sellOrderId)
      if (buyOrder?.userId === userId || sellOrder?.userId === userId) {
        result.push(trade)
      }
    }
    result.sort((a, b) => b.time - a.time)
    return result.slice(0, limit)
  },

  getAll(): TradeRecord[] {
    return [...trades]
  },

  clear(): void {
    trades.length = 0
  },
}
