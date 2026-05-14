export interface UserInfo {
  userId: string
  username: string
  balance: number
  frozenBalance: number
}

export interface StockQuote {
  code: string
  name: string
  price: number
  change: number
  changePercent: number
}

export interface Order {
  id: string
  userId: string
  stockCode: string
  type: 'buy' | 'sell'
  price: number
  quantity: number
  filledQuantity: number
  status: 'pending' | 'partial' | 'filled' | 'cancelled'
  createdAt: number
}

export interface Position {
  stockCode: string
  stockName: string
  quantity: number
  avgPrice: number
  currentPrice: number
}

export interface Trade {
  id: string
  stockCode: string
  price: number
  quantity: number
  type: 'buy' | 'sell'
  time: number
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface RegisterRequest {
  username: string
  password: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface CreateOrderRequest {
  stockCode: string
  type: 'buy' | 'sell'
  price: number
  quantity: number
}

export interface WsMessage {
  type: 'quote' | 'quotes' | 'order' | 'position' | 'trade' | 'user' | 'sync' | 'error'
  data: unknown
  eventSeq?: number
}

export interface WsQuoteData {
  code: string
  name: string
  price: number
  change: number
  changePercent: number
}

export interface WsOrderData {
  order: Order
}

export interface WsPositionData {
  positions: Position[]
}

export interface WsTradeData {
  trade: Trade
}

export interface WsUserData {
  userId: string
  username: string
  balance: number
  frozenBalance: number
}

export interface WsQuotesData {
  [code: string]: StockQuote
}

export interface WsSyncData {
  quotes: Record<string, StockQuote>
  orders: Order[]
  positions: Position[]
  trades: Trade[]
  user: UserInfo | null
  pnlCurve: PnlCurveEntry[]
}

export interface WsErrorData {
  message: string
}

export interface PnlCurveEntry {
  date: string
  value: number
}

export interface LoginResponse {
  user: UserInfo
  positions: Position[]
  orders: Order[]
  trades: Trade[]
  pnlCurve: PnlCurveEntry[]
}
