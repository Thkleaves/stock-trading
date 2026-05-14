<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useTheme } from '@/composables/useTheme'
import {
  MOCK_USER_PROFILE,
  MOCK_USER_POSITIONS,
  MOCK_USER_TRADES,
} from '@/data/mock'

const { isDark } = useTheme()

const activeTab = ref<'positions' | 'trades'>('positions')

function formatMoney(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1e8) {
    return (v / 1e8).toFixed(2) + '亿'
  } else if (abs >= 1e4) {
    return (v / 1e4).toFixed(2) + '万'
  }
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatPnl(v: number): string {
  const sign = v >= 0 ? '+' : ''
  return `${sign}${formatMoney(v)}`
}

const outlineCards = computed(() => [
  { label: '总资产', value: MOCK_USER_PROFILE.totalAsset, color: '' },
  { label: '持仓市值', value: MOCK_USER_PROFILE.marketValue, color: '' },
  { label: '可用余额', value: MOCK_USER_PROFILE.balance, color: '' },
  {
    label: '累计盈亏',
    value: MOCK_USER_PROFILE.totalPnl,
    color: MOCK_USER_PROFILE.totalPnl >= 0 ? 'color-up' : 'color-down',
    suffix: ` (${MOCK_USER_PROFILE.totalPnlPercent >= 0 ? '+' : ''}${MOCK_USER_PROFILE.totalPnlPercent}%)`,
  },
])

const canvasRef = ref<HTMLCanvasElement | null>(null)
let resizeObserver: ResizeObserver | null = null

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

  const data = MOCK_USER_PROFILE.pnlCurve
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
    const cx1 = scaleX(i - 1) + pw / data.length / 2
    const cx2 = scaleX(i) - pw / data.length / 2
    ctx.bezierCurveTo(cx1, scaleY(values[i - 1]), cx2, scaleY(values[i]), scaleX(i), scaleY(values[i]))
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
  ctx.beginPath()
  ctx.arc(lastX, lastY, 4, 0, Math.PI * 2)
  ctx.fillStyle = tc.line
  ctx.fill()
  ctx.strokeStyle = tc.dotStroke
  ctx.lineWidth = 2
  ctx.stroke()
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
          <canvas ref="canvasRef" class="pnl-canvas"></canvas>
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
              <tr v-for="p in MOCK_USER_POSITIONS" :key="p.stockCode">
                <td>
                  <span class="pos-name">{{ p.stockName }}</span>
                  <span class="pos-code">{{ p.stockCode }}</span>
                </td>
                <td class="mono">{{ p.quantity }}股</td>
                <td class="mono">{{ p.avgPrice.toFixed(2) }}</td>
                <td class="mono">{{ p.currentPrice.toFixed(2) }}</td>
                <td :class="['mono', p.pnl >= 0 ? 'color-up' : 'color-down']">
                  {{ formatPnl(p.pnl) }}
                </td>
                <td :class="['mono', p.pnlPercent >= 0 ? 'color-up' : 'color-down']">
                  {{ p.pnlPercent >= 0 ? '+' : '' }}{{ p.pnlPercent.toFixed(2) }}%
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
              <tr v-for="t in MOCK_USER_TRADES" :key="t.id">
                <td>
                  <span class="pos-name">{{ t.stockName }}</span>
                  <span class="pos-code">{{ t.stockCode }}</span>
                </td>
                <td :class="t.type === 'buy' ? 'color-up' : 'color-down'">
                  {{ t.type === 'buy' ? '买入' : '卖出' }}
                </td>
                <td class="mono">{{ t.price.toFixed(2) }}</td>
                <td class="mono">{{ t.quantity }}股</td>
                <td :class="['mono', t.pnl >= 0 ? 'color-up' : 'color-down']">
                  {{ t.pnl === 0 ? '--' : (t.pnl >= 0 ? '+' : '') + t.pnl.toFixed(2) }}
                </td>
                <td class="mono text-muted">{{ t.time.slice(5) }}</td>
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
