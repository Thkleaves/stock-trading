import type { PnlCurveEntry, Stock } from '../types/index.js'
import { getStockByCode, INITIAL_BALANCE, INITIAL_STOCK_SHARES } from '../types/index.js'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const STOCKS_DIR = join(__dirname, '..', '..', 'data', 'stocks')

const curves = new Map<string, PnlCurveEntry[]>()
const initialAssets = new Map<string, number>()

function todayStr(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function csvPath(stock: Stock): string {
  return join(STOCKS_DIR, `${stock.code}_${stock.name}.csv`)
}

function readClosePrices(stock: Stock): { date: string; close: number }[] {
  const filepath = csvPath(stock)
  if (!existsSync(filepath)) return []
  const raw = readFileSync(filepath, 'utf-8')
  const lines = raw.trim().split('\n')
  const result: { date: string; close: number }[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    if (cols.length < 6) continue
    result.push({ date: cols[0].trim(), close: parseFloat(cols[2]) })
  }
  return result
}

function computeHistoricalPnl(
  stockCodes: string[],
  positionCost: number,
  days: number
): PnlCurveEntry[] {
  const stockPrices = new Map<string, Map<string, number>>()
  let allDates: string[] = []

  for (const code of stockCodes) {
    const stock = getStockByCode(code)
    if (!stock) continue
    const prices = readClosePrices(stock)
    const map = new Map<string, number>()
    for (const p of prices) {
      map.set(p.date, p.close)
    }
    stockPrices.set(code, map)
    if (allDates.length === 0) {
      allDates = prices.map((p) => p.date)
    }
  }

  const simulationToday = allDates.length > 0 ? allDates.reduce((a, b) => a > b ? a : b) : ''
  const recentDates = allDates.filter(d => d < simulationToday).slice(-days)
  const result: PnlCurveEntry[] = []

  for (const date of recentDates) {
    let portfolioValue = 0
    let coveredCount = 0
    for (const code of stockCodes) {
      const priceMap = stockPrices.get(code)
      const close = priceMap?.get(date)
      if (close !== undefined) {
        portfolioValue += close * INITIAL_STOCK_SHARES
        coveredCount++
      }
    }
    if (coveredCount === 0) continue
    const pnl = portfolioValue - positionCost
    result.push({ date, value: Math.round(pnl * 100) / 100 })
  }

  return result
}

export const pnlCurveStore = {
  generateForUser(userId: string, stockCodes: string[]): PnlCurveEntry[] {
    let positionCost = 0
    for (const code of stockCodes) {
      const stock = getStockByCode(code)
      if (stock) {
        positionCost += INITIAL_STOCK_SHARES * stock.initialPrice
      }
    }

    initialAssets.set(userId, INITIAL_BALANCE + positionCost)

    const data = computeHistoricalPnl(stockCodes, positionCost, 30)
    curves.set(userId, data)
    console.log(
      `[pnl] 为用户 ${userId.slice(0, 8)} 生成盈亏曲线, ${data.length} 个数据点, ` +
        `持仓: ${stockCodes.join(',')}, 初始总资产: ${(INITIAL_BALANCE + positionCost).toLocaleString()}`
    )
    return data
  },

  getByUserId(userId: string): PnlCurveEntry[] {
    return curves.get(userId) ?? []
  },

  getInitialAssets(userId: string): number {
    return initialAssets.get(userId) ?? 0
  },

  appendEntry(userId: string, value: number): void {
    const data = curves.get(userId)
    if (!data) return
    data.push({ date: todayStr(), value: Math.round(value * 100) / 100 })
  },

  loadFrom(curveMap: Record<string, PnlCurveEntry[]>, assetMap: Record<string, number>): void {
    curves.clear()
    for (const [userId, entries] of Object.entries(curveMap)) {
      if (Array.isArray(entries)) {
        curves.set(userId, entries)
      }
    }
    initialAssets.clear()
    for (const [userId, value] of Object.entries(assetMap)) {
      initialAssets.set(userId, value)
    }
  },

  getAll(): { curves: Record<string, PnlCurveEntry[]>; initialAssets: Record<string, number> } {
    return {
      curves: Object.fromEntries(curves),
      initialAssets: Object.fromEntries(initialAssets),
    }
  },

  clear(): void {
    curves.clear()
    initialAssets.clear()
  },
}
