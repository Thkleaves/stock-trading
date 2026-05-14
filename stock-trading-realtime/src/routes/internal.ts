import { Router, Request, Response } from 'express'
import { sendToUser, getConnectionCount } from '../ws/server.js'

const router = Router()

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', connections: getConnectionCount() })
})

router.post('/event', (req: Request, res: Response) => {
  const { type, userId, eventSeq, data } = req.body

  if (!type || !userId) {
    res.status(400).json({ ok: false, message: '缺少 type 或 userId' })
    return
  }

  const validTypes = ['order', 'position', 'trade', 'user']
  if (!validTypes.includes(type)) {
    res.status(400).json({ ok: false, message: '无效的事件类型' })
    return
  }

  if (type === 'order') {
    sendToUser(userId, { type: 'order', eventSeq, data: { order: data } })
  } else if (type === 'position') {
    sendToUser(userId, { type: 'position', eventSeq, data: { positions: data } })
  } else if (type === 'trade') {
    sendToUser(userId, { type: 'trade', eventSeq, data: { trade: data } })
  } else if (type === 'user') {
    sendToUser(userId, { type: 'user', eventSeq, data })
  }

  res.json({ ok: true })
})

export default router
