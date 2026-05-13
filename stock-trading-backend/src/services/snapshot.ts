import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { User, Order, PositionRecord, TradeRecord } from '../types/index.js'
import { usersStore } from '../store/users.js'
import { ordersStore } from '../store/orders.js'
import { positionsStore } from '../store/positions.js'
import { tradesStore } from '../store/trades.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SNAPSHOT_PATH = join(__dirname, '..', '..', 'data', 'snapshot.json')

interface SnapshotData {
  users: User[]
  orders: Order[]
  positions: PositionRecord[]
  trades: TradeRecord[]
}

export function loadSnapshot(): boolean {
  try {
    if (!existsSync(SNAPSHOT_PATH)) return false
    const raw = readFileSync(SNAPSHOT_PATH, 'utf-8')
    const data: SnapshotData = JSON.parse(raw)
    usersStore.loadFrom(data.users ?? [])
    ordersStore.loadFrom(data.orders ?? [])
    positionsStore.loadFrom(data.positions ?? [])
    tradesStore.loadFrom(data.trades ?? [])
    console.log(`[snapshot] 已加载快照: ${data.users?.length ?? 0} 用户, ${data.orders?.length ?? 0} 委托, ${data.positions?.length ?? 0} 持仓, ${data.trades?.length ?? 0} 成交`)
    return true
  } catch (e) {
    console.error('[snapshot] 加载快照失败:', e)
    return false
  }
}

export function saveSnapshot(): void {
  try {
    mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true })
    const data: SnapshotData = {
      users: usersStore.getAll(),
      orders: ordersStore.getAll(),
      positions: positionsStore.getAllFlat(),
      trades: tradesStore.getAll(),
    }
    writeFileSync(SNAPSHOT_PATH, JSON.stringify(data, null, 2), 'utf-8')
  } catch (e) {
    console.error('[snapshot] 保存快照失败:', e)
  }
}

export function startAutoSave(intervalMs = 5000): void {
  setInterval(saveSnapshot, intervalMs)
  process.on('SIGINT', () => { saveSnapshot(); process.exit() })
  process.on('SIGTERM', () => { saveSnapshot(); process.exit() })
  console.log(`[snapshot] 自动保存已启动, 间隔 ${intervalMs / 1000}s`)
}
