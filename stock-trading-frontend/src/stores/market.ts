import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import type { StockQuote } from '@/types'

const MOCK_QUOTES: StockQuote[] = [
  { code: '000063', name: '中兴通讯', price: 32.50, change: 0, changePercent: 0 },
  { code: '000333', name: '美的集团', price: 55.80, change: 0, changePercent: 0 },
  { code: '000651', name: '格力电器', price: 38.60, change: 0, changePercent: 0 },
  { code: '000725', name: '京东方A', price: 4.50,  change: 0, changePercent: 0 },
  { code: '000858', name: '五粮液',   price: 148.0, change: 0, changePercent: 0 },
  { code: '002230', name: '科大讯飞', price: 52.00, change: 0, changePercent: 0 },
  { code: '002415', name: '海康威视', price: 35.00, change: 0, changePercent: 0 },
  { code: '002475', name: '立讯精密', price: 30.00, change: 0, changePercent: 0 },
  { code: '002594', name: '比亚迪',   price: 260.0, change: 0, changePercent: 0 },
  { code: '300059', name: '东方财富', price: 18.00, change: 0, changePercent: 0 },
  { code: '300124', name: '汇川技术', price: 62.00, change: 0, changePercent: 0 },
  { code: '300750', name: '宁德时代', price: 200.0, change: 0, changePercent: 0 },
  { code: '600036', name: '招商银行', price: 38.00, change: 0, changePercent: 0 },
  { code: '600276', name: '恒瑞医药', price: 45.00, change: 0, changePercent: 0 },
  { code: '600519', name: '贵州茅台', price: 1600., change: 0, changePercent: 0 },
  { code: '600809', name: '山西汾酒', price: 220.0, change: 0, changePercent: 0 },
  { code: '600900', name: '长江电力', price: 28.00, change: 0, changePercent: 0 },
  { code: '601012', name: '隆基绿能', price: 22.00, change: 0, changePercent: 0 },
  { code: '601318', name: '中国平安', price: 48.00, change: 0, changePercent: 0 },
  { code: '601899', name: '紫金矿业', price: 16.00, change: 0, changePercent: 0 },
]

export const useMarketStore = defineStore('market', () => {
  const quotes = reactive<Record<string, StockQuote>>({})
  const timestamp = ref('')

  function loadMockData() {
    if (Object.keys(quotes).length > 0) return
    MOCK_QUOTES.forEach((q) => {
      quotes[q.code] = q
    })
  }

  function updateQuote(quote: StockQuote) {
    quotes[quote.code] = quote
  }

  function setTimestamp(ts: string) {
    timestamp.value = ts
  }

  function getQuote(code: string): StockQuote | undefined {
    return quotes[code]
  }

  return { quotes, timestamp, loadMockData, updateQuote, setTimestamp, getQuote }
})
