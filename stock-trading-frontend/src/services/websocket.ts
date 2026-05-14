import { useMarketStore } from '@/stores/market'
import { useOrderStore } from '@/stores/order'
import { usePositionStore } from '@/stores/position'
import { useTradeStore } from '@/stores/trade'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/services/api'
import type { WsMessage, WsQuoteData, WsQuotesData, WsOrderData, WsPositionData, WsTradeData, WsUserData, WsSyncData, WsErrorData, Trade, Order, Position } from '@/types'

const WS_URL = 'ws://localhost:3001'
const MAX_RECONNECT_INTERVAL = 30000
const INITIAL_RECONNECT_INTERVAL = 1000
const POLLING_INTERVAL = 5000

class MarketWebSocket {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pollingTimer: ReturnType<typeof setInterval> | null = null
  private reconnectAttempts = 0
  private userId: string | null = null
  private intentionalClose = false

  connect(userId: string) {
    this.userId = userId
    this.intentionalClose = false
    this.reconnectAttempts = 0
    this.createConnection()
  }

  disconnect() {
    this.intentionalClose = true
    this.clearReconnectTimer()
    this.stopPolling()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  private createConnection() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return

    this.ws = new WebSocket(WS_URL)

    this.ws.onopen = () => {
      console.log('[WebSocket] 已连接')
      this.reconnectAttempts = 0
      this.stopPolling()
      this.subscribe()
      this.resync()
    }

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg: WsMessage = JSON.parse(event.data)
        this.dispatch(msg)
      } catch (e) {
        console.error('[WebSocket] 消息解析失败', e)
      }
    }

    this.ws.onerror = (error: Event) => {
      console.error('[WebSocket] 连接错误', error)
    }

    this.ws.onclose = () => {
      console.log('[WebSocket] 连接关闭')
      this.ws = null
      if (!this.intentionalClose) {
        this.startPolling()
        this.scheduleReconnect()
      }
    }
  }

  private subscribe() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.userId) {
      this.ws.send(JSON.stringify({ type: 'subscribe', userId: this.userId }))
    }
  }

  private resync() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.userId) {
      this.ws.send(JSON.stringify({ type: 'resync', userId: this.userId }))
    }
  }

  private isEventType(type: string): boolean {
    return type === 'trade' || type === 'order' || type === 'position' || type === 'user'
  }

  private handleEventSeq(msg: WsMessage): 'ok' | 'skip' | 'gap' {
    const tradeStore = useTradeStore()
    if (!this.isEventType(msg.type)) return 'ok'
    return tradeStore.tryApplySeq(msg.eventSeq)
  }

  private dispatch(msg: WsMessage) {
    const seqResult = this.handleEventSeq(msg)
    if (seqResult === 'skip') return
    if (seqResult === 'gap') {
      console.warn('[WebSocket] 事件序号跳跃，触发增量同步')
      this.incrementalResync()
    }

    switch (msg.type) {
      case 'quote': {
        const data = msg.data as WsQuoteData
        useMarketStore().updateQuote(data)
        break
      }
      case 'quotes': {
        const data = msg.data as WsQuotesData
        const marketStore = useMarketStore()
        Object.values(data).forEach((quote) => {
          marketStore.updateQuote(quote)
        })
        break
      }
      case 'order': {
        const data = msg.data as WsOrderData
        useOrderStore().upsertOrder(data.order)
        break
      }
      case 'position': {
        const data = msg.data as WsPositionData
        usePositionStore().setPositions(data.positions)
        break
      }
      case 'trade': {
        const data = msg.data as WsTradeData
        useTradeStore().addTrade(data.trade)
        break
      }
      case 'user': {
        const data = msg.data as WsUserData
        useAuthStore().setUserData(data)
        break
      }
      case 'sync': {
        const data = msg.data as WsSyncData
        const marketStore = useMarketStore()
        Object.values(data.quotes).forEach((quote) => {
          marketStore.updateQuote(quote)
        })
        useOrderStore().setOrders(data.orders as Order[])
        usePositionStore().setPositions(data.positions as Position[])
        useTradeStore().setTrades(data.trades as Trade[])
        useTradeStore().resetEventSeq()
        if (data.user) {
          useAuthStore().setUserData(data.user)
        }
        break
      }
      case 'error': {
        const data = msg.data as WsErrorData
        console.error('[WebSocket] 服务端错误:', data.message)
        break
      }
      default:
        console.warn('[WebSocket] 未知消息类型', msg.type)
    }
  }

  private async incrementalResync() {
    if (!this.userId) return
    try {
      const res = (await api.get('/api/trades')) as unknown as { trades: Trade[] }
      const orderRes = (await api.get('/api/orders')) as unknown as { orders: Order[] }
      const positionRes = (await api.get('/api/positions')) as unknown as { positions: Position[] }
      const userRes = (await api.get('/api/auth/user')) as unknown as { balance: number; frozenBalance: number }

      useTradeStore().addTrades(res.trades || [])
      useOrderStore().setOrders(orderRes.orders || [])
      usePositionStore().setPositions(positionRes.positions || [])
      useAuthStore().setUserData(userRes)
    } catch {
      console.warn('[WebSocket] 增量同步失败，将在下次轮询重试')
    }
  }

  private startPolling() {
    if (this.pollingTimer) return
    console.log('[WebSocket] 启动轮询兜底')
    this.pollingTimer = setInterval(() => {
      this.pollData()
    }, POLLING_INTERVAL)
  }

  private stopPolling() {
    if (this.pollingTimer) {
      console.log('[WebSocket] 停止轮询兜底')
      clearInterval(this.pollingTimer)
      this.pollingTimer = null
    }
  }

  private async pollData() {
    if (!this.userId) return
    try {
      const res = (await api.get('/api/trades')) as unknown as { trades: Trade[] }
      const orderRes = (await api.get('/api/orders')) as unknown as { orders: Order[] }
      const positionRes = (await api.get('/api/positions')) as unknown as { positions: Position[] }
      const userRes = (await api.get('/api/auth/user')) as unknown as { balance: number; frozenBalance: number }

      useTradeStore().addTrades(res.trades || [])
      useOrderStore().setOrders(orderRes.orders || [])
      usePositionStore().setPositions(positionRes.positions || [])

      useAuthStore().setUserData(userRes)
    } catch {
      // 轮询失败静默处理，下一轮重试
    }
  }

  private scheduleReconnect() {
    this.clearReconnectTimer()
    const delay = Math.min(
      INITIAL_RECONNECT_INTERVAL * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_INTERVAL
    )
    this.reconnectAttempts++
    console.log(`[WebSocket] ${delay / 1000}s 后重连`)
    this.reconnectTimer = setTimeout(() => {
      this.createConnection()
    }, delay)
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }
}

export const marketWebSocket = new MarketWebSocket()
