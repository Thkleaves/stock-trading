import { v4 as uuid } from 'uuid'
import type { Order } from '../types/index.js'

const orders = new Map<string, Order>()

function sortOrders(a: Order, b: Order): number {
  if (a.type !== b.type) return 0
  if (a.type === 'buy') {
    if (b.price !== a.price) return b.price - a.price
    return a.createdAt - b.createdAt
  } else {
    if (a.price !== b.price) return a.price - b.price
    return a.createdAt - b.createdAt
  }
}

export const ordersStore = {
  create(params: {
    userId: string
    stockCode: string
    type: 'buy' | 'sell'
    price: number
    quantity: number
  }): Order {
    const order: Order = {
      id: uuid(),
      userId: params.userId,
      stockCode: params.stockCode,
      type: params.type,
      price: params.price,
      quantity: params.quantity,
      filledQuantity: 0,
      status: 'pending',
      createdAt: Date.now(),
    }
    orders.set(order.id, order)
    return order
  },

  getById(id: string): Order | undefined {
    return orders.get(id)
  },

  getByUser(userId: string): Order[] {
    const result: Order[] = []
    for (const order of orders.values()) {
      if (order.userId === userId) {
        result.push(order)
      }
    }
    result.sort((a, b) => b.createdAt - a.createdAt)
    return result
  },

  getPendingBuyOrders(stockCode: string): Order[] {
    const result: Order[] = []
    for (const order of orders.values()) {
      if (
        order.stockCode === stockCode &&
        order.type === 'buy' &&
        (order.status === 'pending' || order.status === 'partial')
      ) {
        result.push(order)
      }
    }
    result.sort(sortOrders)
    return result
  },

  getPendingSellOrders(stockCode: string): Order[] {
    const result: Order[] = []
    for (const order of orders.values()) {
      if (
        order.stockCode === stockCode &&
        order.type === 'sell' &&
        (order.status === 'pending' || order.status === 'partial')
      ) {
        result.push(order)
      }
    }
    result.sort(sortOrders)
    return result
  },

  updateFilled(orderId: string, filledQuantity: number): Order | undefined {
    const order = orders.get(orderId)
    if (!order) return undefined
    order.filledQuantity = filledQuantity
    if (filledQuantity === 0) {
      order.status = 'pending'
    } else if (filledQuantity >= order.quantity) {
      order.status = 'filled'
    } else {
      order.status = 'partial'
    }
    return order
  },

  setCancelled(orderId: string): Order | undefined {
    const order = orders.get(orderId)
    if (!order) return undefined
    order.status = 'cancelled'
    return order
  },

  remove(orderId: string): boolean {
    return orders.delete(orderId)
  },

  clear(): void {
    orders.clear()
  },
}
