export interface StockInfo {
  code: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: number
  high: number
  low: number
  open: number
  preClose: number
}

export interface KLineData {
  date: string
  open: number
  close: number
  high: number
  low: number
  volume: number
}

export interface UserOrder {
  id: string
  stockCode: string
  stockName: string
  type: 'buy' | 'sell'
  price: number
  quantity: number
  filledQuantity: number
  status: 'pending' | 'partial' | 'filled' | 'cancelled'
  time: string
}

export interface UserTrade {
  id: string
  stockCode: string
  stockName: string
  type: 'buy' | 'sell'
  price: number
  quantity: number
  time: string
  pnl: number
}

export interface UserPosition {
  stockCode: string
  stockName: string
  quantity: number
  avgPrice: number
  currentPrice: number
  pnl: number
  pnlPercent: number
}

export interface UserProfile {
  balance: number
  totalPnl: number
  totalPnlPercent: number
  marketValue: number
  totalAsset: number
  pnlCurve: { date: string; value: number }[]
}

function seedRandom(seed: number): () => number {
  return () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
}

function generateKLines(
  basePrice: number,
  days: number,
  volatility: number,
  seed: number
): KLineData[] {
  const rand = seedRandom(seed)
  const result: KLineData[] = []
  const now = new Date()
  let price = basePrice

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    if (d.getDay() === 0) { d.setDate(d.getDate() - 2) }
    if (d.getDay() === 6) { d.setDate(d.getDate() - 1) }

    const change = (rand() - 0.48) * volatility * 2
    const open = price
    const close = open * (1 + change)
    const high = Math.max(open, close) * (1 + rand() * volatility * 0.5)
    const low = Math.min(open, close) * (1 - rand() * volatility * 0.5)
    const volume = Math.floor(10000000 + rand() * 90000000)

    result.push({
      date: d.toISOString().split('T')[0],
      open: +open.toFixed(2),
      close: +close.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      volume,
    })
    price = close
  }

  return result
}

const STOCK_DEFS: { code: string; name: string; basePrice: number; volatility: number; seed: number }[] = [
  { code: '000001', name: '上证指数', basePrice: 3218, volatility: 0.012, seed: 1 },
  { code: '000002', name: '万科A', basePrice: 8.32, volatility: 0.025, seed: 2 },
  { code: '600519', name: '贵州茅台', basePrice: 1680, volatility: 0.018, seed: 3 },
  { code: '000858', name: '五粮液', basePrice: 156.8, volatility: 0.020, seed: 4 },
  { code: '601318', name: '中国平安', basePrice: 42.3, volatility: 0.015, seed: 5 },
  { code: '600036', name: '招商银行', basePrice: 35.6, volatility: 0.016, seed: 6 },
  { code: '000333', name: '美的集团', basePrice: 56.2, volatility: 0.018, seed: 7 },
  { code: '600276', name: '恒瑞医药', basePrice: 48.9, volatility: 0.022, seed: 8 },
  { code: '300750', name: '宁德时代', basePrice: 185, volatility: 0.028, seed: 9 },
  { code: '002415', name: '海康威视', basePrice: 32.8, volatility: 0.020, seed: 10 },
  { code: '000725', name: '京东方A', basePrice: 4.15, volatility: 0.020, seed: 11 },
  { code: '600030', name: '中信证券', basePrice: 22.6, volatility: 0.018, seed: 12 },
  { code: '002714', name: '牧原股份', basePrice: 44.5, volatility: 0.022, seed: 13 },
  { code: '000651', name: '格力电器', basePrice: 38.7, volatility: 0.016, seed: 14 },
  { code: '600900', name: '长江电力', basePrice: 28.3, volatility: 0.010, seed: 15 },
  { code: '002594', name: '比亚迪', basePrice: 238, volatility: 0.024, seed: 16 },
  { code: '601012', name: '隆基绿能', basePrice: 18.6, volatility: 0.030, seed: 17 },
  { code: '600809', name: '山西汾酒', basePrice: 235, volatility: 0.022, seed: 18 },
  { code: '300059', name: '东方财富', basePrice: 15.8, volatility: 0.026, seed: 19 },
  { code: '601899', name: '紫金矿业', basePrice: 15.2, volatility: 0.022, seed: 20 },
]

const KLINE_DAYS = 60

export const MOCK_STOCKS: Record<string, KLineData[]> = {}
export const MOCK_STOCK_LIST: StockInfo[] = []

STOCK_DEFS.forEach((def) => {
  const kLines = generateKLines(def.basePrice, KLINE_DAYS, def.volatility, def.seed)
  MOCK_STOCKS[def.code] = kLines

  const latest = kLines[kLines.length - 1]
  const prev = kLines[kLines.length - 2]
  const change = latest.close - prev.close
  const changePercent = (change / prev.close) * 100

  MOCK_STOCK_LIST.push({
    code: def.code,
    name: def.name,
    price: latest.close,
    change: +change.toFixed(2),
    changePercent: +changePercent.toFixed(2),
    volume: latest.volume,
    high: latest.high,
    low: latest.low,
    open: latest.open,
    preClose: prev.close,
  })
})

export const MOCK_USER_PROFILE: UserProfile = {
  balance: 456_230.50,
  totalPnl: 82_345.20,
  totalPnlPercent: 12.34,
  marketValue: 538_575.70,
  totalAsset: 994_806.20,
  pnlCurve: Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    const base = 912_461
    const noise = Math.sin(i * 0.3) * 30000 + (Math.random() - 0.5) * 15000
    return {
      date: d.toISOString().split('T')[0],
      value: Math.round(base + i * 2000 + noise),
    }
  }),
}

export const MOCK_USER_ORDERS: UserOrder[] = [
  { id: 'o1', stockCode: '600519', stockName: '贵州茅台', type: 'buy', price: 1650, quantity: 100, filledQuantity: 100, status: 'filled', time: '2025-05-10 10:30:00' },
  { id: 'o2', stockCode: '000858', stockName: '五粮液', type: 'buy', price: 150.5, quantity: 500, filledQuantity: 500, status: 'filled', time: '2025-05-10 14:15:00' },
  { id: 'o3', stockCode: '002594', stockName: '比亚迪', type: 'buy', price: 230, quantity: 300, filledQuantity: 300, status: 'filled', time: '2025-05-08 09:45:00' },
  { id: 'o4', stockCode: '000333', stockName: '美的集团', type: 'sell', price: 58, quantity: 400, filledQuantity: 400, status: 'filled', time: '2025-05-07 11:20:00' },
  { id: 'o5', stockCode: '600030', stockName: '中信证券', type: 'sell', price: 24, quantity: 1000, filledQuantity: 1000, status: 'filled', time: '2025-05-06 13:00:00' },
  { id: 'o6', stockCode: '300750', stockName: '宁德时代', type: 'buy', price: 178, quantity: 200, filledQuantity: 0, status: 'pending', time: '2025-05-12 15:00:00' },
  { id: 'o7', stockCode: '601318', stockName: '中国平安', type: 'sell', price: 45, quantity: 300, filledQuantity: 0, status: 'pending', time: '2025-05-12 14:30:00' },
]

export const MOCK_USER_TRADES: UserTrade[] = [
  { id: 't1', stockCode: '600519', stockName: '贵州茅台', type: 'buy', price: 1650, quantity: 100, time: '2025-05-10 10:30:12', pnl: 0 },
  { id: 't2', stockCode: '000858', stockName: '五粮液', type: 'buy', price: 150.5, quantity: 500, time: '2025-05-10 14:15:33', pnl: 0 },
  { id: 't3', stockCode: '002594', stockName: '比亚迪', type: 'buy', price: 230, quantity: 300, time: '2025-05-08 09:45:08', pnl: 0 },
  { id: 't4', stockCode: '000333', stockName: '美的集团', type: 'sell', price: 58, quantity: 400, time: '2025-05-07 11:20:44', pnl: 1800 },
  { id: 't5', stockCode: '600030', stockName: '中信证券', type: 'sell', price: 24, quantity: 1000, time: '2025-05-06 13:00:22', pnl: 3200 },
  { id: 't6', stockCode: '002415', stockName: '海康威视', type: 'buy', price: 31.5, quantity: 600, time: '2025-05-05 10:15:00', pnl: 0 },
  { id: 't7', stockCode: '600900', stockName: '长江电力', type: 'buy', price: 27.8, quantity: 2000, time: '2025-05-03 14:20:00', pnl: 0 },
  { id: 't8', stockCode: '000651', stockName: '格力电器', type: 'sell', price: 40.2, quantity: 500, time: '2025-05-01 09:50:00', pnl: -1500 },
]

export const MOCK_USER_POSITIONS: UserPosition[] = [
  { stockCode: '600519', stockName: '贵州茅台', quantity: 100, avgPrice: 1650, currentPrice: 1685.30, pnl: 3530, pnlPercent: 2.14 },
  { stockCode: '000858', stockName: '五粮液', quantity: 500, avgPrice: 150.5, currentPrice: 157.20, pnl: 3350, pnlPercent: 4.45 },
  { stockCode: '002594', stockName: '比亚迪', quantity: 300, avgPrice: 230, currentPrice: 240.50, pnl: 3150, pnlPercent: 4.57 },
  { stockCode: '002415', stockName: '海康威视', quantity: 600, avgPrice: 31.5, currentPrice: 33.10, pnl: 960, pnlPercent: 5.08 },
  { stockCode: '600900', stockName: '长江电力', quantity: 2000, avgPrice: 27.8, currentPrice: 28.45, pnl: 1300, pnlPercent: 2.34 },
]

export function getStockKLines(code: string): KLineData[] {
  return MOCK_STOCKS[code] || []
}
