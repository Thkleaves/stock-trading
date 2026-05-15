<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useTheme } from '@/composables/useTheme'
import { useSimulation } from '@/composables/useSimulation'
import { useAuthStore } from '@/stores/auth'
import { usePositionStore } from '@/stores/position'
import { useTradeStore } from '@/stores/trade'
import { usePnlCurveStore } from '@/stores/pnlCurve'

const { isDark } = useTheme()
const { currentPrices, stockRefs } = useSimulation()
const authStore = useAuthStore()
const positionStore = usePositionStore()
const tradeStore = useTradeStore()
const pnlCurveStore = usePnlCurveStore()

const activeTab = ref<'positions' | 'trades'>('positions')

function stockNameByCode(code: string): string {
  return stockRefs.value[code]?.name ?? code
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function formatMoney(v: number): string {
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatPnl(v: number): string {
  const sign = v >= 0 ? '+' : ''
  return `${sign}${formatMoney(v)}`
}

function pnlVal(pos: { quantity: number; avgPrice: number; stockCode: string }): number {
  const cp = currentPrices[pos.stockCode] ?? pos.avgPrice
  return +((cp - pos.avgPrice) * pos.quantity).toFixed(2)
}

function pnlPercentVal(pos: { quantity: number; avgPrice: number; stockCode: string }): number {
  const cp = currentPrices[pos.stockCode] ?? pos.avgPrice
  return pos.avgPrice > 0 ? +(((cp - pos.avgPrice) / pos.avgPrice) * 100).toFixed(2) : 0
}

const positions = computed(() => positionStore.positions)

const marketValue = computed(() =>
  positions.value.reduce((sum, p) => {
    const cp = currentPrices[p.stockCode] ?? p.avgPrice
    return sum + cp * p.quantity
  }, 0)
)

const totalPnl = computed(() =>
  positions.value.reduce((sum, p) => sum + pnlVal(p), 0)
)

const totalPnlPercent = computed(() => {
  const cost = positions.value.reduce((sum, p) => sum + p.avgPrice * p.quantity, 0)
  return cost > 0 ? (totalPnl.value / cost) * 100 : 0
})

const totalAsset = computed(() => authStore.balance + marketValue.value)

const outlineCards = computed(() => [
  { label: '总资产', value: totalAsset.value, color: '' },
  { label: '持仓市值', value: +marketValue.value.toFixed(2), color: '' },
  { label: '可用余额', value: authStore.balance, color: '' },
  {
    label: '累计盈亏',
    value: totalPnl.value,
    color: totalPnl.value >= 0 ? 'color-up' : 'color-down',
    suffix: ` (${totalPnlPercent.value >= 0 ? '+' : ''}${totalPnlPercent.value.toFixed(2)}%)`,
  },
])

const canvasRef = ref<HTMLCanvasElement | null>(null)
let resizeObserver: ResizeObserver | null = null

const pnlCurveData = computed(() => pnlCurveStore.data)

const crosshair = ref<{ idx: number; mouseX: number; mouseY: number } | null>(null)

function findNearestPoint(mouseX: number, padLeft: number, pw: number, dataLen: number): number {
  const scaleX = (i: number) => padLeft + (i / (dataLen - 1)) * pw
  let nearestIdx = 0
  let minDist = Infinity
  for (let i = 0; i < dataLen; i++) {
    const dist = Math.abs(scaleX(i) - mouseX)
    if (dist < minDist) {
      minDist = dist
      nearestIdx = i
    }
  }
  return nearestIdx
}

function drawPnlCurve() {
  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  ctx.scale(dpr, dpr)

  const w = rect.width
  const h = rect.height
  const pad = { top: 16, right: 16, bottom: 28, left: 60 }
  const pw = w - pad.left - pad.right
  const ph = h - pad.top - pad.bottom

  const dark = isDark.value
  const tc = {
    bg: dark ? '#161b22' : '#ffffff',
    grid: dark ? '#21262d' : '#e8eaed',
    text: dark ? '#8b949e' : '#5f6368',
    textMuted: dark ? '#6e7681' : '#9aa0a6',
    line: dark ? '#58a6ff' : '#1a73e8',
    gradientStart: dark ? 'rgba(88,166,255,0.12)' : 'rgba(26,115,232,0.12)',
    gradientEnd: dark ? 'rgba(88,166,255,0.01)' : 'rgba(26,115,232,0.01)',
    dotStroke: dark ? '#161b22' : '#ffffff',
  }

  ctx.clearRect(0, 0, w, h)

  ctx.fillStyle = tc.bg
  ctx.fillRect(0, 0, w, h)

  const data = pnlCurveData.value
  if (data.length < 2) return

  const values = data.map((d) => d.value)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const range = maxVal - minVal || 1
  const scaleY = (v: number) => pad.top + ph - ((v - minVal) / range) * ph
  const scaleX = (i: number) => pad.left + (i / (data.length - 1)) * pw

  ctx.strokeStyle = tc.grid
  ctx.lineWidth = 0.5
  const gridLines = 5
  for (let i = 0; i <= gridLines; i++) {
    const y = pad.top + (ph / gridLines) * i
    ctx.beginPath()
    ctx.moveTo(pad.left, y)
    ctx.lineTo(w - pad.right, y)
    ctx.stroke()

    const labelVal = maxVal - (range / gridLines) * i
    ctx.fillStyle = tc.text
    ctx.font = '10px -apple-system, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(formatMoney(labelVal), pad.left - 6, y + 4)
  }

  const labelIndices = [0, Math.floor(data.length / 4), Math.floor(data.length / 2), Math.floor((3 * data.length) / 4), data.length - 1]
  ctx.fillStyle = tc.textMuted
  ctx.font = '10px -apple-system, sans-serif'
  ctx.textAlign = 'center'
  for (const idx of labelIndices) {
    if (idx < data.length) {
      const x = scaleX(idx)
      ctx.fillText(data[idx].date.slice(5), x, h - 4)
    }
  }

  const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + ph)
  gradient.addColorStop(0, tc.gradientStart)
  gradient.addColorStop(1, tc.gradientEnd)

  ctx.beginPath()
  ctx.moveTo(scaleX(0), scaleY(values[0]))
  for (let i = 1; i < values.length; i++) {
    ctx.lineTo(scaleX(i), scaleY(values[i]))
  }

  ctx.strokeStyle = tc.line
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.lineTo(scaleX(values.length - 1), pad.top + ph)
  ctx.lineTo(scaleX(0), pad.top + ph)
  ctx.closePath()
  ctx.fillStyle = gradient
  ctx.fill()

  const lastX = scaleX(values.length - 1)
  const lastY = scaleY(values[values.length - 1])

  const ch = crosshair.value
  if (ch && ch.idx >= 0 && ch.idx < data.length) {
    const cx = scaleX(ch.idx)
    const cy = scaleY(values[ch.idx])

    ctx.save()
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = tc.textMuted
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx, pad.top)
    ctx.lineTo(cx, pad.top + ph)
    ctx.stroke()
    ctx.restore()

    ctx.beginPath()
    ctx.arc(cx, cy, 5, 0, Math.PI * 2)
    ctx.fillStyle = tc.line
    ctx.fill()
    ctx.strokeStyle = tc.dotStroke
    ctx.lineWidth = 2.5
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2)
    ctx.fillStyle = tc.dotStroke
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2)
    ctx.fillStyle = tc.line
    ctx.fill()
    ctx.strokeStyle = tc.dotStroke
    ctx.lineWidth = 2
    ctx.stroke()
  }
}

function onCanvasMouseMove(e: MouseEvent) {
  const canvas = canvasRef.value
  if (!canvas) return
  const data = pnlCurveData.value
  if (data.length < 2) {
    crosshair.value = null
    return
  }

  const rect = canvas.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top

  const padLeft = 60
  const pw = rect.width - padLeft - 16

  if (mouseX < padLeft || mouseX > rect.width - 16) {
    crosshair.value = null
    return
  }

  const idx = findNearestPoint(mouseX, padLeft, pw, data.length)
  crosshair.value = { idx, mouseX, mouseY }
  drawPnlCurve()
}

function onCanvasMouseLeave() {
  crosshair.value = null
  drawPnlCurve()
}

onMounted(() => {
  nextTick(() => {
    drawPnlCurve()
  })
  if (canvasRef.value) {
    resizeObserver = new ResizeObserver(() => drawPnlCurve())
    resizeObserver.observe(canvasRef.value)
  }
})

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect()
})

watch(isDark, () => {
  nextTick(() => drawPnlCurve())
})

watch(pnlCurveData, () => {
  nextTick(() => drawPnlCurve())
}, { deep: false })
</script>

<template>
  <div class="profile-view">
    <div class="asset-cards">
      <div
        v-for="card in outlineCards"
        :key="card.label"
        class="asset-card card"
      >
        <div class="asset-label">{{ card.label }}</div>
        <div :class="['asset-value', card.color]">
          ¥{{ formatMoney(card.value) }}
        </div>
        <div v-if="card.suffix" :class="['asset-suffix', card.color]">
          {{ card.suffix }}
        </div>
      </div>
    </div>

    <div class="profile-body">
      <div class="pnl-section card">
        <div class="card-header">
          <h3>盈亏曲线</h3>
          <span class="card-subtitle">近30日</span>
        </div>
        <div class="pnl-chart-wrap">
          <canvas
            ref="canvasRef"
            class="pnl-canvas"
            @mousemove="onCanvasMouseMove"
            @mouseleave="onCanvasMouseLeave"
          ></canvas>
          <div
            v-if="crosshair && crosshair.idx >= 0 && crosshair.idx < pnlCurveData.length"
            class="pnl-tooltip"
            :style="{
              left: crosshair.mouseX + 'px',
              top: Math.max(0, crosshair.mouseY - 52) + 'px',
            }"
          >
            <div class="pnl-tooltip-date">{{ pnlCurveData[crosshair.idx].date }}</div>
            <div
              :class="['pnl-tooltip-value', pnlCurveData[crosshair.idx].value >= 0 ? 'color-up' : 'color-down']"
            >
              {{ formatPnl(pnlCurveData[crosshair.idx].value) }}
            </div>
          </div>
        </div>
      </div>

      <div class="detail-section card">
        <div class="card-header">
          <div class="tab-buttons">
            <button
              :class="['tab-btn', { active: activeTab === 'positions' }]"
              @click="activeTab = 'positions'"
            >
              持仓明细
            </button>
            <button
              :class="['tab-btn', { active: activeTab === 'trades' }]"
              @click="activeTab = 'trades'"
            >
              交易记录
            </button>
          </div>
        </div>

        <div v-if="activeTab === 'positions'" class="tab-content">
          <table>
            <thead>
              <tr>
                <th>股票</th>
                <th>持仓</th>
                <th>均价</th>
                <th>现价</th>
                <th>盈亏</th>
                <th>盈亏%</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in positions" :key="p.stockCode">
                <td>
                  <span class="pos-name">{{ stockNameByCode(p.stockCode) }}</span>
                  <span class="pos-code">{{ p.stockCode }}</span>
                </td>
                <td class="mono">{{ p.quantity }}股</td>
                <td class="mono">{{ p.avgPrice.toFixed(2) }}</td>
                <td class="mono">{{ (currentPrices[p.stockCode] ?? p.avgPrice).toFixed(2) }}</td>
                <td :class="['mono', pnlVal(p) >= 0 ? 'color-up' : 'color-down']">
                  {{ formatPnl(pnlVal(p)) }}
                </td>
                <td :class="['mono', pnlVal(p) >= 0 ? 'color-up' : 'color-down']">
                  {{ pnlVal(p) >= 0 ? '+' : '' }}{{ pnlPercentVal(p).toFixed(2) }}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="activeTab === 'trades'" class="tab-content">
          <table>
            <thead>
              <tr>
                <th>股票</th>
                <th>方向</th>
                <th>价格</th>
                <th>数量</th>
                <th>盈亏</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in tradeStore.trades" :key="t.id">
                <td>
                  <span class="pos-name">{{ stockNameByCode(t.stockCode) }}</span>
                  <span class="pos-code">{{ t.stockCode }}</span>
                </td>
                <td :class="t.type === 'buy' ? 'color-up' : 'color-down'">
                  {{ t.type === 'buy' ? '买入' : '卖出' }}
                </td>
                <td class="mono">{{ t.price.toFixed(2) }}</td>
                <td class="mono">{{ t.quantity }}股</td>
                <td :class="['mono', t.type === 'buy' ? 'color-up' : 'color-down']">
                  {{ t.type === 'buy' ? '--' : '--' }}
                </td>
                <td class="mono text-muted">{{ formatTime(t.time).slice(5) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 8px;
  gap: 8px;
  overflow: hidden;
}

.asset-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  flex-shrink: 0;
}

.asset-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.asset-label {
  font-size: 10px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.asset-value {
  font-size: 20px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--text-primary);
}

.asset-suffix {
  font-size: 11px;
  font-family: var(--font-mono);
}

.profile-body {
  flex: 1;
  display: flex;
  gap: 8px;
  min-height: 0;
  overflow: hidden;
}

.pnl-section {
  flex: 3;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.card-subtitle {
  font-size: 10px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.pnl-chart-wrap {
  flex: 1;
  min-height: 0;
  position: relative;
}

.pnl-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.pnl-tooltip {
  position: absolute;
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 10;
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  padding: 6px 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  white-space: nowrap;
  text-align: center;
}

.pnl-tooltip-date {
  font-size: 10px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  margin-bottom: 2px;
}

.pnl-tooltip-value {
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font-mono);
}

.detail-section {
  flex: 2;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tab-buttons {
  display: flex;
  gap: 2px;
}

.tab-btn {
  padding: 4px 12px;
  border: none;
  background: none;
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.15s;
}

.tab-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.tab-btn.active {
  color: var(--accent-neon);
  background: var(--accent-glow);
}

.tab-content {
  flex: 1;
  overflow-y: auto;
  margin-top: 4px;
}

.pos-name {
  font-weight: 500;
  color: var(--text-primary);
}

.pos-code {
  font-size: 10px;
  color: var(--text-muted);
  margin-left: 6px;
  font-family: var(--font-mono);
}

.mono {
  font-family: var(--font-mono);
}

.text-muted {
  color: var(--text-muted);
}
</style>
