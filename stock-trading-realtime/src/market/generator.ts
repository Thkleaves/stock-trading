import type { StockQuote } from '../types/index.js'

interface StockDef {
  code: string
  name: string
  initialPrice: number
  volatility: number
}

export const STOCKS: StockDef[] = [
  { code: '600519', name: '贵州茅台', initialPrice: 1450.0, volatility: 0.22 },
  { code: '000858', name: '五粮液',   initialPrice: 130.0,  volatility: 0.28 },
  { code: '300750', name: '宁德时代', initialPrice: 250.0,  volatility: 0.35 },
  { code: '002594', name: '比亚迪',   initialPrice: 280.0,  volatility: 0.3  },
  { code: '601318', name: '中国平安', initialPrice: 50.0,   volatility: 0.18 },
  { code: '600036', name: '招商银行', initialPrice: 42.0,   volatility: 0.16 },
  { code: '000333', name: '美的集团', initialPrice: 72.0,   volatility: 0.2  },
  { code: '000651', name: '格力电器', initialPrice: 42.0,   volatility: 0.18 },
  { code: '600276', name: '恒瑞医药', initialPrice: 48.0,   volatility: 0.22 },
  { code: '000725', name: '京东方A',  initialPrice: 4.5,    volatility: 0.25 },
  { code: '002415', name: '海康威视', initialPrice: 33.0,   volatility: 0.24 },
  { code: '300059', name: '东方财富', initialPrice: 22.0,   volatility: 0.32 },
  { code: '601012', name: '隆基绿能', initialPrice: 16.0,   volatility: 0.4  },
  { code: '600900', name: '长江电力', initialPrice: 29.0,   volatility: 0.13 },
  { code: '002475', name: '立讯精密', initialPrice: 40.0,   volatility: 0.28 },
  { code: '601899', name: '紫金矿业', initialPrice: 18.0,   volatility: 0.26 },
  { code: '000063', name: '中兴通讯', initialPrice: 38.0,   volatility: 0.3  },
  { code: '600809', name: '山西汾酒', initialPrice: 200.0,  volatility: 0.25 },
  { code: '300124', name: '汇川技术', initialPrice: 65.0,   volatility: 0.28 },
  { code: '002230', name: '科大讯飞', initialPrice: 50.0,   volatility: 0.33 },
  { code: '000001', name: '上证指数', initialPrice: 3200.0, volatility: 0.15 },
  { code: '399001', name: '深证成指', initialPrice: 10000.0,volatility: 0.18 },
  { code: '399006', name: '创业板指', initialPrice: 2000.0, volatility: 0.25 },
]

export function createInitialQuotes(): Map<string, StockQuote> {
  const quotes = new Map<string, StockQuote>()
  for (const stock of STOCKS) {
    quotes.set(stock.code, {
      code: stock.code,
      name: stock.name,
      price: stock.initialPrice,
      change: 0,
      changePercent: 0,
    })
  }
  return quotes
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

export function tick(quotes: Map<string, StockQuote>): void {
  for (const [code, quote] of quotes) {
    const stock = STOCKS.find((s) => s.code === code)
    const vol = stock ? stock.volatility : 0.2
    const prevPrice = quote.price
    const pct = (Math.random() - 0.5) * vol / 100
    const newPrice = prevPrice * (1 + pct)
    quote.price = round(newPrice, 2)
    quote.change = round(newPrice - prevPrice, 2)
    quote.changePercent = round(pct * 100, 2)
  }
}
