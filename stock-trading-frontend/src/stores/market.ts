import { defineStore } from 'pinia'
import { reactive } from 'vue'
import type { StockQuote } from '@/types'

const MOCK_QUOTES: StockQuote[] = [
  { code: '000001', name: '平安银行', price: 12.50, change: 0.15, changePercent: 1.21 },
  { code: '000002', name: '万科A', price: 8.32, change: -0.04, changePercent: -0.48 },
  { code: '000333', name: '美的集团', price: 55.80, change: 0.80, changePercent: 1.44 },
  { code: '000651', name: '格力电器', price: 38.60, change: -0.30, changePercent: -0.77 },
  { code: '000858', name: '五粮液', price: 148.00, change: 2.50, changePercent: 1.72 },
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
