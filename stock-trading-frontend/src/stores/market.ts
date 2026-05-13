import { defineStore } from 'pinia'
import { reactive } from 'vue'
import type { StockQuote } from '@/types'

const MOCK_QUOTES: StockQuote[] = [
  { code: '000001', name: '平安银行', price: 12.50, change: 0.15, changePercent: 1.21 },
  { code: '000002', name: '万科A', price: 8.32, change: -0.04, changePercent: -0.48 },
  { code: '600519', name: '贵州茅台', price: 1680.00, change: 35.30, changePercent: 2.15 },
  { code: '000858', name: '五粮液', price: 156.80, change: -1.20, changePercent: -0.76 },
  { code: '601318', name: '中国平安', price: 42.30, change: 0.55, changePercent: 1.32 },
  { code: '600036', name: '招商银行', price: 35.60, change: -0.30, changePercent: -0.84 },
  { code: '000333', name: '美的集团', price: 56.20, change: 0.80, changePercent: 1.44 },
  { code: '600276', name: '恒瑞医药', price: 48.90, change: -0.55, changePercent: -1.11 },
]

export const useMarketStore = defineStore('market', () => {
  const quotes = reactive<Record<string, StockQuote>>({})

  function loadMockData() {
    if (Object.keys(quotes).length > 0) return
    MOCK_QUOTES.forEach((q) => {
      quotes[q.code] = q
    })
  }

  function updateQuote(quote: StockQuote) {
    quotes[quote.code] = quote
  }

  function getQuote(code: string): StockQuote | undefined {
    return quotes[code]
  }

  return { quotes, loadMockData, updateQuote, getQuote }
})
