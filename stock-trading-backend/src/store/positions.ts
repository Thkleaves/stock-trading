import type { PositionRecord } from '../types/index.js'

const positions = new Map<string, PositionRecord[]>()

function key(userId: string, stockCode: string): string {
  return `${userId}:${stockCode}`
}

export const positionsStore = {
  getByUser(userId: string): PositionRecord[] {
    const result: PositionRecord[] = []
    for (const pos of positions.values()) {
      for (const p of pos) {
        if (p.userId === userId && p.quantity > 0) {
          result.push({ ...p })
        }
      }
    }
    return result
  },

  getOne(userId: string, stockCode: string): PositionRecord | undefined {
    const posList = positions.get(key(userId, stockCode))
    if (!posList || posList.length === 0) return undefined
    return posList[0]
  },

  addPosition(userId: string, stockCode: string, quantity: number, price: number): void {
    const posList = positions.get(key(userId, stockCode))
    if (!posList || posList.length === 0) {
      positions.set(key(userId, stockCode), [
        { userId, stockCode, quantity, avgPrice: price },
      ])
      return
    }
    const pos = posList[0]
    const totalCost = pos.avgPrice * pos.quantity + price * quantity
    pos.quantity += quantity
    pos.avgPrice = pos.quantity > 0 ? totalCost / pos.quantity : 0
  },

  reducePosition(userId: string, stockCode: string, quantity: number): void {
    const posList = positions.get(key(userId, stockCode))
    if (!posList || posList.length === 0) return
    const pos = posList[0]
    pos.quantity -= quantity
    if (pos.quantity <= 0) {
      positions.delete(key(userId, stockCode))
    }
  },

  getQuantity(userId: string, stockCode: string): number {
    const pos = this.getOne(userId, stockCode)
    return pos?.quantity ?? 0
  },

  clear(): void {
    positions.clear()
  },
}
