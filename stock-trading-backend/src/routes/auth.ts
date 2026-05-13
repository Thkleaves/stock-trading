import { Router, type Request, type Response } from 'express'
import type { RegisterRequest, LoginRequest, UserInfo } from '../types/index.js'
import { STOCKS } from '../types/index.js'
import { usersStore } from '../store/users.js'
import { positionsStore } from '../store/positions.js'

const INITIAL_SHARES = 100

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

    const userInfo: UserInfo = {
      userId: user.id,
      username: user.username,
      balance: user.balance,
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

    const userInfo: UserInfo = {
      userId: user.id,
      username: user.username,
      balance: user.balance,
    }
    res.json(userInfo)
  }
)

router.get(
  '/user',
  (req: Request, res: Response) => {
    const userId = req.query.userId as string
    if (!userId) {
      res.status(400).json({ message: '缺少 userId 参数' })
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
    }
    res.json(userInfo)
  }
)

export default router
