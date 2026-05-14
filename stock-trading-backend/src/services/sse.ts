import type { Request, Response } from 'express'
import type { RealtimeEvent } from '../types/index.js'

const clients = new Map<string, Set<Response>>()

export function setupSSEEndpoint() {
  return (req: Request, res: Response) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    res.write(':ok\n\n')

    const userId = req.cookies?.userId as string | undefined
      ?? req.headers['x-user-id'] as string | undefined

    const key = userId ?? '__anon__'
    if (!clients.has(key)) {
      clients.set(key, new Set())
    }
    clients.get(key)!.add(res)

    const keepAlive = setInterval(() => {
      res.write(':ping\n\n')
    }, 15000)

    req.on('close', () => {
      clearInterval(keepAlive)
      clients.get(key)?.delete(res)
      if (clients.get(key)?.size === 0) {
        clients.delete(key)
      }
    })
  }
}

export function pushEvent(event: RealtimeEvent): void {
  const conns = clients.get(event.userId)
  if (!conns) return
  const payload = `data: ${JSON.stringify(event)}\n\n`
  for (const res of conns) {
    res.write(payload)
  }
}

export function pushEvents(events: RealtimeEvent[]): void {
  for (const evt of events) {
    pushEvent(evt)
  }
}
