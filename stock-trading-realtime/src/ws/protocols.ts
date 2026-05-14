export const WS_MESSAGE_TYPES = {
  SERVER_TO_CLIENT: ['quote', 'quotes', 'order', 'position', 'trade', 'user', 'sync', 'pong', 'error'] as const,
  CLIENT_TO_SERVER: ['subscribe', 'resync', 'ping'] as const,
} as const

export interface WsServerMessage {
  type: 'quote' | 'quotes' | 'order' | 'position' | 'trade' | 'user' | 'sync' | 'pong' | 'error'
  data: unknown
  eventSeq?: number
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
  data: Record<string, {
    code: string
    name: string
    price: number
    change: number
    changePercent: number
  }>
}

export interface SyncMessage {
  type: 'sync'
  data: {
    quotes: Record<string, unknown>
    orders: unknown[]
    positions: unknown[]
    trades: unknown[]
  }
}

export interface ErrorMessage {
  type: 'error'
  data: {
    message: string
  }
}
