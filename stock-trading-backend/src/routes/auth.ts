import { Router, type Request, type Response } from 'express'
import type { RegisterRequest, LoginRequest, UserInfo } from '../types/index.js'
import { STOCKS } from '../types/index.js'
import { usersStore } from '../store/users.js'
import { positionsStore } from '../store/positions.js'

const INITIAL_SHARES = 100

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 24 * 60 * 60 * 1000,
}

const router = Router()

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

    const user = usersStore.create(username, password)

    for (const stock of STOCKS) {
      positionsStore.addPosition(user.id, stock.code, INITIAL_SHARES, stock.initialPrice)
    }

    res.cookie('userId', user.id, COOKIE_OPTIONS)

    const userInfo: UserInfo = {
      userId: user.id,
      username: user.username,
      balance: user.balance,
      frozenBalance: user.frozenBalance,
    }
    res.json(userInfo)
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

    const userInfo: UserInfo = {
      userId: user.id,
      username: user.username,
      balance: user.balance,
      frozenBalance: user.frozenBalance,
    }
    res.json(userInfo)
  }
)

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

export default router
