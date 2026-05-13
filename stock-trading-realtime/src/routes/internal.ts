import { Router, Request, Response } from 'express'
import { sendToUser, getConnectionCount } from '../ws/server.js'

const router = Router()

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', connections: getConnectionCount() })
})

router.post('/event', (req: Request, res: Response) => {
  const { type, userId, data } = req.body

  if (!type || !userId) {
    res.status(400).json({ ok: false, message: '缺少 type 或 userId' })
    return
  }

  const validTypes = ['order', 'position', 'trade']
  if (!validTypes.includes(type)) {
    res.status(400).json({ ok: false, message: '无效的事件类型' })
    return
  }

  if (type === 'order') {
    sendToUser(userId, { type: 'order', data: { order: data } })
  } else if (type === 'position') {
    sendToUser(userId, { type: 'position', data: { positions: data } })
  } else if (type === 'trade') {
    sendToUser(userId, { type: 'trade', data: { trade: data } })
  }

  res.json({ ok: true })
})

export default router
