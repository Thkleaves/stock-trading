import { useMarketStore } from '@/stores/market'
import { useOrderStore } from '@/stores/order'
import { usePositionStore } from '@/stores/position'
import { useTradeStore } from '@/stores/trade'
import type { WsMessage, WsQuoteData, WsOrderData, WsPositionData, WsTradeData, WsSyncData } from '@/types'

const WS_URL = 'ws://localhost:3001'
const MAX_RECONNECT_INTERVAL = 30000
const INITIAL_RECONNECT_INTERVAL = 1000

class MarketWebSocket {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
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
      this.subscribe()
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

  private dispatch(msg: WsMessage) {
    switch (msg.type) {
      case 'quote': {
        const data = msg.data as WsQuoteData
        useMarketStore().updateQuote(data)
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
      case 'sync': {
        const data = msg.data as WsSyncData
        const marketStore = useMarketStore()
        Object.values(data.quotes).forEach((quote) => {
          marketStore.updateQuote(quote)
        })
        useOrderStore().setOrders(data.orders)
        usePositionStore().setPositions(data.positions)
        useTradeStore().setTrades(data.trades)
        break
      }
      default:
        console.warn('[WebSocket] 未知消息类型', msg.type)
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
      this.resync()
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
