export interface User {
  id: string
  username: string
  password: string
  balance: number
  frozenBalance: number
}

export interface Stock {
  code: string
  name: string
  initialPrice: number
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

export interface PositionRecord {
  userId: string
  stockCode: string
  quantity: number
  avgPrice: number
}

export interface TradeRecord {
  id: string
  buyOrderId: string
  sellOrderId: string
  stockCode: string
  price: number
  quantity: number
  time: number
}

export interface UserInfo {
  userId: string
  username: string
  balance: number
  frozenBalance: number
}

export interface PositionResponse {
  stockCode: string
  stockName: string
  quantity: number
  avgPrice: number
  currentPrice: number
}

export interface TradeResponse {
  id: string
  stockCode: string
  price: number
  quantity: number
  type: 'buy' | 'sell'
  time: number
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

export type RealtimeEvent =
  | { type: 'order'; userId: string; eventSeq: number; data: Order }
  | { type: 'position'; userId: string; eventSeq: number; data: PositionResponse[] }
  | { type: 'trade'; userId: string; eventSeq: number; data: TradeResponse }
  | { type: 'user'; userId: string; eventSeq: number; data: UserInfo }

export const STOCKS: Stock[] = [
  { code: '000001', name: '平安银行', initialPrice: 12.50 },
  { code: '000002', name: '万科A', initialPrice: 8.32 },
  { code: '000333', name: '美的集团', initialPrice: 55.80 },
  { code: '000651', name: '格力电器', initialPrice: 38.60 },
  { code: '000858', name: '五粮液', initialPrice: 148.00 },
]

export const INITIAL_BALANCE = 1_000_000

export function getStockByCode(code: string): Stock | undefined {
  return STOCKS.find((s) => s.code === code)
}
