export const WS_MESSAGE_TYPES = {
  SERVER_TO_CLIENT: ['quote', 'quotes', 'order', 'position', 'trade', 'user', 'sync', 'pong', 'error', 'indexHistory'] as const,
  CLIENT_TO_SERVER: ['subscribe', 'resync', 'ping'] as const,
} as const

export interface WsServerMessage {
  type: 'quote' | 'quotes' | 'order' | 'position' | 'trade' | 'user' | 'sync' | 'pong' | 'error' | 'indexHistory'
  data: unknown
  eventSeq?: number
  timestamp?: string
  code?: string
}

export interface WsClientMessage {
  type: 'subscribe' | 'resync' | 'ping'
  userId?: string
  data?: unknown
}

export interface QuoteMessage {
  type: 'quote'
  data: {
    code: string
    name: string
    price: number
    change: number
    changePercent: number
  }
}

export interface QuotesMessage {
  type: 'quotes'
  timestamp: string
  data: Record<string, {
    code: string
    name: string
    price: number
    change: number
    changePercent: number
  }>
}

export interface KLineItem {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface DailyOhlcItem {
  code: string
  name: string
  type: 'stock' | 'index'
  open: number
  high: number
  low: number
  preClose: number
}

export interface SyncMessage {
  type: 'sync'
  data: {
    quotes: Record<string, unknown>
    orders: unknown[]
    positions: unknown[]
    trades: unknown[]
    user?: unknown
    pnlCurve?: unknown[]
    klDaily?: Record<string, KLineItem[]>
    klWeekly?: Record<string, KLineItem[]>
    klMonthly?: Record<string, KLineItem[]>
    dailyOhlc?: DailyOhlcItem[]
  }
}

export interface ErrorMessage {
  type: 'error'
  data: {
    message: string
  }
}

export interface IndexHistoryMessage {
  type: 'indexHistory'
  code: string
  data: {
    time: string
    price: number
  }[]
}
