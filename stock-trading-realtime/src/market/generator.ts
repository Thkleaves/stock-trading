import type { StockQuote } from '../types/index.js'

export const STOCKS = [
  { code: '000001', name: '平安银行', initialPrice: 12.50 },
  { code: '000002', name: '万科A',   initialPrice: 8.32 },
  { code: '000333', name: '美的集团', initialPrice: 55.80 },
  { code: '000651', name: '格力电器', initialPrice: 38.60 },
  { code: '000858', name: '五粮液',   initialPrice: 148.00 },
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
  for (const [, quote] of quotes) {
    const prevPrice = quote.price
    const pct = (Math.random() - 0.5) * 0.01
    const newPrice = prevPrice * (1 + pct)
    quote.price = round(newPrice, 2)
    quote.change = round(newPrice - prevPrice, 2)
    quote.changePercent = round(pct * 100, 2)
  }
}
