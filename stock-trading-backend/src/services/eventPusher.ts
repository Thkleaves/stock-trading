import type { RealtimeEvent } from '../types/index.js'

const REALTIME_URL = 'http://localhost:3001'

export async function pushEvent(event: RealtimeEvent): Promise<void> {
  try {
    await fetch(`${REALTIME_URL}/internal/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    })
  } catch {
    // 实时服务不可用时静默忽略，不阻塞撮合
  }
}
