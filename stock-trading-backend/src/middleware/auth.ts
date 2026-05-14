import type { Request, Response, NextFunction } from 'express'
import { usersStore } from '../store/users.js'

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const cookieUserId = req.cookies?.userId
  if (cookieUserId) {
    const user = usersStore.getById(cookieUserId)
    if (user) {
      req.userId = cookieUserId
      return next()
    }
  }

  const headerUserId = req.headers['x-user-id'] as string | undefined
  if (headerUserId) {
    const user = usersStore.getById(headerUserId)
    if (user) {
      req.userId = headerUserId
      return next()
    }
  }

  res.status(401).json({ message: '未登录或登录已过期' })
}
