import { Router, type Request, type Response } from 'express'
import type { RegisterRequest, LoginRequest, UserInfo, PositionResponse, TradeResponse } from '../types/index.js'
import { STOCKS, INITIAL_STOCK_SHARES, INITIAL_STOCK_COUNT, getStockByCode } from '../types/index.js'
import { usersStore } from '../store/users.js'
import { positionsStore } from '../store/positions.js'
import { ordersStore } from '../store/orders.js'
import { tradesStore } from '../store/trades.js'
import { pnlCurveStore } from '../store/pnlCurve.js'

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 24 * 60 * 60 * 1000,
}

const router = Router()

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

router.post(
  '/register',
  (req: Request<object, object, RegisterRequest>, res: Response) => {
    const { username, password } = req.body

    if (!username || !password) {
      res.status(400).json({ message: '用户名和密码不能为空' })
      return
    }

    if (usersStore.existsByUsername(username)) {
      res.status(409).json({ message: '用户名已存在' })
      return
    }

    const picks = shuffle(STOCKS).slice(0, INITIAL_STOCK_COUNT)
    const stockCodes: string[] = picks.map((s) => s.code)

    const user = usersStore.create(username, password, stockCodes)

    for (const stock of picks) {
      positionsStore.addPosition(user.id, stock.code, INITIAL_STOCK_SHARES, stock.initialPrice)
    }

    pnlCurveStore.generateForUser(user.id, stockCodes)

    res.cookie('userId', user.id, COOKIE_OPTIONS)

    const positions = positionsStore.getByUser(user.id).map(toPosResp)
    res.json({
      user: { userId: user.id, username: user.username, balance: user.balance, frozenBalance: user.frozenBalance },
      positions,
      orders: [],
      trades: [],
      pnlCurve: pnlCurveStore.getByUserId(user.id),
    })
  }
)

router.post(
  '/login',
  (req: Request<object, object, LoginRequest>, res: Response) => {
    const { username, password } = req.body

    if (!username || !password) {
      res.status(400).json({ message: '用户名和密码不能为空' })
      return
    }

    const user = usersStore.findByUsername(username)
    if (!user || user.password !== password) {
      res.status(401).json({ message: '用户名或密码错误' })
      return
    }

    res.cookie('userId', user.id, COOKIE_OPTIONS)

    const positions = positionsStore.getByUser(user.id).map(toPosResp)
    const trades = tradesStore.getByUser(user.id).map((t) => toTradeResp(t, user.id))

    res.json({
      user: { userId: user.id, username: user.username, balance: user.balance, frozenBalance: user.frozenBalance },
      positions,
      orders: ordersStore.getByUser(user.id),
      trades,
      pnlCurve: pnlCurveStore.getByUserId(user.id),
    })
  }
)

function toTradeResp(trade: { id: string; buyOrderId: string; sellOrderId: string; stockCode: string; price: number; quantity: number; time: number }, userId: string): TradeResponse {
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

  return { id: trade.id, stockCode: trade.stockCode, price: trade.price, quantity: trade.quantity, type, time: trade.time }
}

function toPosResp(r: { userId: string; stockCode: string; quantity: number; avgPrice: number }): PositionResponse {
  const stock = getStockByCode(r.stockCode)
  return { stockCode: r.stockCode, stockName: stock?.name ?? r.stockCode, quantity: r.quantity, avgPrice: r.avgPrice, currentPrice: stock?.initialPrice ?? 0 }
}

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('userId', { path: '/' })
  res.json({ message: '已退出登录' })
})

router.get(
  '/user',
  (req: Request, res: Response) => {
    const userId = req.cookies?.userId as string | undefined
      ?? req.headers['x-user-id'] as string | undefined
    if (!userId) {
      res.status(401).json({ message: '未登录' })
      return
    }
    const user = usersStore.getById(userId)
    if (!user) {
      res.status(404).json({ message: '用户不存在' })
      return
    }
    const userInfo: UserInfo = {
      userId: user.id,
      username: user.username,
      balance: user.balance,
      frozenBalance: user.frozenBalance,
    }
    res.json(userInfo)
  }
)

router.get(
  '/pnl-curve',
  (req: Request, res: Response) => {
    const userId = req.cookies?.userId as string | undefined
      ?? req.headers['x-user-id'] as string | undefined
    if (!userId) {
      res.status(401).json({ message: '未登录' })
      return
    }
    const data = pnlCurveStore.getByUserId(userId)
    res.json(data)
  }
)

export default router
