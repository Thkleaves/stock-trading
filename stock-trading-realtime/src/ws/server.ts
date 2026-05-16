import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import type { WsClientMessage, WsServerMessage } from './protocols.js'

const clients = new Map<string, Set<WebSocket>>()
const wsToUser = new Map<WebSocket, string>()
const pendingClients = new Set<WebSocket>()

let onSubscribeCallback: ((userId: string, ws: WebSocket) => void) | null = null
let onResyncCallback: ((userId: string, ws: WebSocket) => void) | null = null
let onDisconnectCallback: ((userId: string) => void) | null = null
let onSetSpeedCallback: ((speed: number) => void) | null = null
let onResetCallback: (() => void) | null = null

export function onSubscribe(cb: (userId: string, ws: WebSocket) => void) {
  onSubscribeCallback = cb
}

export function onResync(cb: (userId: string, ws: WebSocket) => void) {
  onResyncCallback = cb
}

export function onDisconnect(cb: (userId: string) => void) {
  onDisconnectCallback = cb
}

export function onSetSpeed(cb: (speed: number) => void) {
  onSetSpeedCallback = cb
}

export function onReset(cb: () => void) {
  onResetCallback = cb
}

function heartbeat(ws: WebSocket) {
  ws.ping()
}

function registerClient(userId: string, ws: WebSocket) {
  pendingClients.delete(ws)
  wsToUser.set(ws, userId)

  let userSet = clients.get(userId)
  if (!userSet) {
    userSet = new Set()
    clients.set(userId, userSet)
  }
  userSet.add(ws)
}

function unregisterClient(ws: WebSocket) {
  pendingClients.delete(ws)
  const userId = wsToUser.get(ws)
  if (userId) {
    const userSet = clients.get(userId)
    if (userSet) {
      userSet.delete(ws)
      if (userSet.size === 0) {
        clients.delete(userId)
      }
    }
    wsToUser.delete(ws)
    onDisconnectCallback?.(userId)
  }
}

export function configureWebSocket(wss: WebSocketServer) {
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      heartbeat(ws)
    })
  }, 30000)

  wss.on('close', () => {
    clearInterval(heartbeatInterval)
  })

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    pendingClients.add(ws)

    ws.on('pong', () => {})

    ws.on('message', (raw: Buffer) => {
      let msg: WsClientMessage
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        sendToWs(ws, { type: 'error', data: { message: '无效的消息格式' } })
        return
      }

      switch (msg.type) {
        case 'subscribe': {
          if (!msg.userId) {
            sendToWs(ws, { type: 'error', data: { message: 'subscribe 消息缺少 userId' } })
            return
          }
          registerClient(msg.userId, ws)
          onSubscribeCallback?.(msg.userId, ws)
          break
        }
        case 'resync': {
          if (!msg.userId) {
            sendToWs(ws, { type: 'error', data: { message: 'resync 消息缺少 userId' } })
            return
          }
          const existingUserId = wsToUser.get(ws)
          if (!existingUserId) {
            registerClient(msg.userId, ws)
          }
          onResyncCallback?.(msg.userId, ws)
          break
        }
        case 'ping': {
          sendToWs(ws, { type: 'pong', data: {} })
          break
        }
        case 'setSpeed': {
          if (msg.speed == null || ![1, 10, 60, 180].includes(msg.speed)) {
            sendToWs(ws, { type: 'error', data: { message: '无效的速度值，支持 1, 10, 60, 180' } })
            return
          }
          onSetSpeedCallback?.(msg.speed)
          break
        }
        case 'reset': {
          onResetCallback?.()
          break
        }
        default: {
          sendToWs(ws, { type: 'error', data: { message: `未知的消息类型: ${(msg as WsClientMessage).type}` } })
        }
      }
    })

    ws.on('close', () => {
      unregisterClient(ws)
    })

    ws.on('error', () => {
      unregisterClient(ws)
    })
  })
}

function sendToWs(ws: WebSocket, message: WsServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message))
  }
}

export function broadcastAll(message: WsServerMessage) {
  const data = JSON.stringify(message)
  wss?.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data)
    }
  })
}

let wss: WebSocketServer | null = null

export function setWss(server: WebSocketServer) {
  wss = server
}

export function sendToUser(userId: string, message: WsServerMessage) {
  const userSet = clients.get(userId)
  if (!userSet) return
  const data = JSON.stringify(message)
  for (const ws of userSet) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data)
    }
  }
}

export function getConnectionCount(): number {
  return wsToUser.size
}

export function getUserIds(): string[] {
  return Array.from(clients.keys())
}
