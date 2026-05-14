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

export interface Trade {
  id: string
  buyOrderId: string
  sellOrderId: string
  stockCode: string
  price: number
  quantity: number
  time: number
}

export interface Position {
  userId: string
  stockCode: string
  quantity: number
  avgPrice: number
}

export interface UserInfo {
  userId: string
  username: string
  balance: number
  frozenBalance: number
}
