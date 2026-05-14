import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const STOCKS_CSV_PATH = join(__dirname, '..', '..', 'data', 'stock_master.csv')

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

export interface PnlCurveEntry {
  date: string
  value: number
}

export type RealtimeEvent =
  | { type: 'order'; userId: string; eventSeq: number; data: Order }
  | { type: 'position'; userId: string; eventSeq: number; data: PositionResponse[] }
  | { type: 'trade'; userId: string; eventSeq: number; data: TradeResponse }
  | { type: 'user'; userId: string; eventSeq: number; data: UserInfo }

export const INITIAL_BALANCE = 1_000_000
export const INITIAL_STOCK_SHARES = 1000
export const INITIAL_STOCK_COUNT = 5

export let STOCKS: Stock[] = []

export function loadStocksFromCsv(): void {
  const raw = readFileSync(STOCKS_CSV_PATH, 'utf-8')
  const lines = raw.trim().split('\n')
  STOCKS = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    if (cols.length < 4) continue
    const type = cols[2].trim()
    if (type !== 'stock') continue
    STOCKS.push({
      code: cols[0].trim(),
      name: cols[1].trim(),
      initialPrice: parseFloat(cols[3]),
    })
  }
  console.log(`[stocks] 从 stock_master.csv 加载了 ${STOCKS.length} 只股票`)
}

export function getStockByCode(code: string): Stock | undefined {
  return STOCKS.find((s) => s.code === code)
}
