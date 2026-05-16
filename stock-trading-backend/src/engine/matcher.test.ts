import { describe, it, expect, beforeEach } from 'vitest'
import { usersStore } from '../store/users.js'
import { ordersStore } from '../store/orders.js'
import { positionsStore } from '../store/positions.js'
import { tradesStore } from '../store/trades.js'
import { matchOrder, validateBuy, validateSell } from './matcher.js'
import type { Order, User } from '../types/index.js'

function createUser(id: string, balance = 1_000_000): User {
  const user: User = { id, username: `u_${id}`, password: 'pass', balance, frozenBalance: 0, initialStockCodes: [] }
  usersStore._unsafeSet(user)
  return user
}

function createOrder(params: {
  userId: string
  stockCode: string
  type: 'buy' | 'sell'
  price: number
  quantity: number
}): Order {
  const order = ordersStore.create(params)
  if (params.type === 'buy') {
    usersStore.freezeBalance(params.userId, params.price * params.quantity)
  } else {
    positionsStore.addPosition(params.userId, params.stockCode, params.quantity, params.price)
  }
  return order
}

beforeEach(() => {
  usersStore.clear()
  ordersStore.clear()
  positionsStore.clear()
  tradesStore.clear()
})

describe('撮合引擎单元测试', () => {
  it('完全成交：买单价格 > 卖单价格，数量相等，一笔成交', async () => {
    createUser('u1')
    createUser('u2')

    const sellOrder = createOrder({ userId: 'u2', stockCode: '000001', type: 'sell', price: 12.0, quantity: 100 })
    await new Promise((r) => setTimeout(r, 2))
    const buyOrder = createOrder({ userId: 'u1', stockCode: '000001', type: 'buy', price: 12.5, quantity: 100 })

    const result = matchOrder(buyOrder)

    expect(result.trades).toHaveLength(1)
    expect(result.trades[0].price).toBe(12.0)
    expect(result.trades[0].quantity).toBe(100)

    const u1 = usersStore.getById('u1')!
    const u2 = usersStore.getById('u2')!
    expect(u1.balance).toBe(1_000_000 - 12.0 * 100)
    expect(u2.balance).toBe(1_000_000 + 12.0 * 100)

    const updatedBuy = ordersStore.getById(buyOrder.id)!
    const updatedSell = ordersStore.getById(sellOrder.id)!
    expect(updatedBuy.status).toBe('filled')
    expect(updatedSell.status).toBe('filled')
  })

  it('价格优先：多个买单，高价优先成交', () => {
    createUser('u1', 1_000_000)
    createUser('u2', 1_000_000)
    createUser('u3')

    createOrder({ userId: 'u3', stockCode: '000001', type: 'sell', price: 12.0, quantity: 100 })

    createOrder({ userId: 'u1', stockCode: '000001', type: 'buy', price: 12.5, quantity: 100 })
    const highBuy = createOrder({ userId: 'u2', stockCode: '000001', type: 'buy', price: 14.0, quantity: 100 })

    matchOrder(highBuy)

    const u2Order = ordersStore.getById(highBuy.id)!
    const u1Order = ordersStore.getByUser('u1')[0]
    expect(u2Order.status).toBe('filled')
    expect(u1Order.status).toBe('pending')
  })

  it('时间优先：同价位，先到先成交', () => {
    createUser('u1')
    createUser('u3')

    const order1 = createOrder({ userId: 'u3', stockCode: '000001', type: 'sell', price: 12.0, quantity: 50 })
    const order2 = createOrder({ userId: 'u3', stockCode: '000001', type: 'sell', price: 12.0, quantity: 50 })

    const buyOrder = createOrder({ userId: 'u1', stockCode: '000001', type: 'buy', price: 13.0, quantity: 100 })

    matchOrder(buyOrder)

    expect(ordersStore.getById(order1.id)!.status).toBe('filled')
    expect(ordersStore.getById(order2.id)!.status).toBe('filled')
  })

  it('部分成交：数量不匹配，部分成交后剩余继续挂单', () => {
    createUser('u1')
    createUser('u2')

    createOrder({ userId: 'u2', stockCode: '000001', type: 'sell', price: 12.0, quantity: 100 })

    const buyOrder = createOrder({ userId: 'u1', stockCode: '000001', type: 'buy', price: 12.5, quantity: 50 })
    const result = matchOrder(buyOrder)

    expect(result.trades).toHaveLength(1)
    expect(result.trades[0].quantity).toBe(50)

    const sellAfter = ordersStore.getByUser('u2')[0]
    expect(sellAfter.status).toBe('partial')
    expect(sellAfter.filledQuantity).toBe(50)
  })

  it('价格不匹配：买价 < 卖价，不成交，挂单等待', () => {
    createUser('u1')
    createUser('u2')

    createOrder({ userId: 'u2', stockCode: '000001', type: 'sell', price: 15.0, quantity: 100 })

    const buyOrder = createOrder({ userId: 'u1', stockCode: '000001', type: 'buy', price: 10.0, quantity: 100 })
    const result = matchOrder(buyOrder)

    expect(result.trades).toHaveLength(0)
    const buyAfter = ordersStore.getById(buyOrder.id)!
    expect(buyAfter.status).toBe('pending')
  })

  it('多笔连续撮合：一个大单匹配多个小单', () => {
    createUser('u1')
    createUser('u2')
    createUser('u3')

    createOrder({ userId: 'u2', stockCode: '000001', type: 'sell', price: 12.0, quantity: 30 })
    createOrder({ userId: 'u3', stockCode: '000001', type: 'sell', price: 12.5, quantity: 40 })

    const buyOrder = createOrder({ userId: 'u1', stockCode: '000001', type: 'buy', price: 13.0, quantity: 100 })
    const result = matchOrder(buyOrder)

    expect(result.trades).toHaveLength(2)
    const totalQty = result.trades.reduce((s, t) => s + t.quantity, 0)
    expect(totalQty).toBe(70)

    const buyAfter = ordersStore.getById(buyOrder.id)!
    expect(buyAfter.status).toBe('partial')
    expect(buyAfter.filledQuantity).toBe(70)
  })

  it('自成交防护：同一用户的买卖单不应相互撮合', () => {
    createUser('u1')

    createOrder({ userId: 'u1', stockCode: '000001', type: 'sell', price: 12.0, quantity: 100 })

    const buyOrder = createOrder({ userId: 'u1', stockCode: '000001', type: 'buy', price: 12.5, quantity: 100 })
    const result = matchOrder(buyOrder)

    expect(result.trades).toHaveLength(0)
    const buyAfter = ordersStore.getById(buyOrder.id)!
    expect(buyAfter.status).toBe('pending')
  })

  it('自成交防护：用户卖单不匹配自己的买单，但仍匹配他人买单', () => {
    createUser('u1')
    createUser('u2')

    createOrder({ userId: 'u1', stockCode: '000001', type: 'sell', price: 12.0, quantity: 100 })
    createOrder({ userId: 'u1', stockCode: '000001', type: 'buy', price: 13.0, quantity: 50 })

    const buyOrder = createOrder({ userId: 'u2', stockCode: '000001', type: 'buy', price: 13.0, quantity: 100 })
    const result = matchOrder(buyOrder)

    expect(result.trades).toHaveLength(1)
    expect(result.trades[0].quantity).toBe(100)
  })

  it('资金不足校验：买入超过余额，应拒绝', () => {
    createUser('u1', 1000)
    expect(validateBuy(100, 100, 1000)).toBe('资金不足')
    expect(validateBuy(10, 100, 1000)).toBeNull()
  })

  it('持仓不足校验：卖出超过持仓，应拒绝', () => {
    createUser('u1')
    positionsStore.addPosition('u1', '000001', 50, 12.0)
    expect(validateSell('u1', '000001', 100)).toBe('持仓不足')
    expect(validateSell('u1', '000001', 50)).toBeNull()
  })
})
