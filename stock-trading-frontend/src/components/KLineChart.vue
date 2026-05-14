<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useTheme } from '@/composables/useTheme'
import type { KLineData, TickData, ChartMode } from '@/data/mock'

const props = defineProps<{
  data: KLineData[]
  tickData?: TickData[]
  mode?: ChartMode
  height?: string
}>()

const { isDark } = useTheme()

const containerRef = ref<HTMLDivElement>()
const canvasRef = ref<HTMLCanvasElement>()

interface ViewState {
  startIndex: number
  endIndex: number
  barWidth: number
  barGap: number
  offsetX: number
}

type Crosshair = {
  visible: boolean
  x: number
  y: number
  index: number
  price: number
  openPrice: number
  changePercent: number
  dateLabel: string
}

let view: ViewState = { startIndex: 0, endIndex: 0, barWidth: 6, barGap: 1, offsetX: 0 }
let crosshair: Crosshair = { visible: false, x: 0, y: 0, index: 0, price: 0, openPrice: 0, changePercent: 0, dateLabel: '' }
let resizeObserver: ResizeObserver | null = null
let animFrameId: number | null = null
let isDragging = false
let dragStartX = 0
let dragStartOffset = 0

interface ThemeColors {
  bg: string
  grid: string
  text: string
  up: string
  down: string
  volUp: string
  volDown: string
  tooltipBg: string
  tooltipText: string
  zeroLine: string
}

function themeColors(): ThemeColors {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
  return dark
    ? {
        bg: '#0d1117',
        grid: '#21262d',
        text: '#8b949e',
        up: '#f85149',
        down: '#3fb950',
        volUp: 'rgba(26,115,232,0.12)',
        volDown: 'rgba(26,115,232,0.06)',
        tooltipBg: '#e6edf3',
        tooltipText: '#0d1117',
        zeroLine: '#30363d',
      }
    : {
        bg: '#fafbfc',
        grid: '#e8eaed',
        text: '#5f6368',
        up: '#d93025',
        down: '#188038',
        volUp: 'rgba(26,115,232,0.15)',
        volDown: 'rgba(26,115,232,0.08)',
        tooltipBg: '#202124',
        tooltipText: '#ffffff',
        zeroLine: '#dadce0',
      }
}

function calcMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = []
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null)
    } else {
      let sum = 0
      for (let j = 0; j < period; j++) sum += data[i - j]
      result.push(+(sum / period).toFixed(2))
    }
  }
  return result
}

function isRealtimeMode(): boolean {
  return (props.mode ?? 'realtime') === 'realtime'
}

function isCandleMode(): boolean {
  const m = props.mode ?? 'realtime'
  return m === 'day' || m === 'week' || m === 'month'
}

function realtimeTimeToFrac(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  const sec = h * 3600 + m * 60
  const M9 = 9 * 3600 + 30 * 60
  const M11 = 11 * 3600 + 30 * 60
  const A13 = 13 * 3600
  const A15 = 15 * 3600
  if (sec <= M9) return 0
  if (sec <= M11) return ((sec - M9) / (M11 - M9)) * 0.5
  if (sec >= A15) return 1
  if (sec >= A13) return 0.5 + ((sec - A13) / (A15 - A13)) * 0.5
  return 0.5
}

function realtimeTimeToX(timeStr: string, chartW: number, padLeft: number): number {
  return padLeft + realtimeTimeToFrac(timeStr) * chartW
}

function effectiveDataCount(): number {
  if (isRealtimeMode() && props.tickData) return props.tickData.length
  return props.data.length
}

function getVisibleRange(): { start: number; end: number } {
  const canvas = canvasRef.value
  if (!canvas) return { start: 0, end: effectiveDataCount() }
  const pad = { left: 50, right: 48 }
  const chartW = canvas.clientWidth - pad.left - pad.right
  const total = effectiveDataCount()
  if (total < 1) return { start: 0, end: 0 }

  if (isRealtimeMode()) return { start: 0, end: total }

  const maxFitBarWidth = (chartW - 1) / total
  const fitStep = 6 + 1
  const defaultVisible = Math.floor(chartW / fitStep)
  if (total <= defaultVisible) {
    view.barWidth = Math.min(maxFitBarWidth - 0.5, 16)
    view.barGap = Math.max(0.5, view.barWidth * 0.15)
    return { start: 0, end: total }
  }

  const step = view.barWidth + view.barGap
  const visibleCount = Math.floor(chartW / step)
  const maxStart = Math.max(0, total - visibleCount)
  const offsetBars = Math.round(Math.max(0, view.offsetX) / step)
  const start = Math.max(0, maxStart - offsetBars)
  const end = Math.min(total, start + visibleCount)
  return { start, end }
}

function getOpenBaseline(slice: Array<KLineData | TickData>): number {
  if (isRealtimeMode()) {
    const tickSlice = slice as TickData[]
    if (tickSlice.length > 0) return tickSlice[0].price
    return 0
  }
  const kSlice = slice as KLineData[]
  if (kSlice.length > 0) return kSlice[0].open
  return 0
}

function getPrices(slice: Array<KLineData | TickData>): number[] {
  if (isRealtimeMode()) return (slice as TickData[]).map((d) => d.price)
  return (slice as KLineData[]).flatMap((d) => [d.high, d.low])
}

function getVolumes(slice: Array<KLineData | TickData>): number[] {
  if (isRealtimeMode()) return (slice as TickData[]).map((d) => d.volume)
  return (slice as KLineData[]).map((d) => d.volume)
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const tc = themeColors()

  const w = canvas.clientWidth
  const h = canvas.clientHeight
  const dpr = window.devicePixelRatio || 1
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)
  }

  ctx.clearRect(0, 0, w, h)

  const pad = { top: 8, bottom: 24, left: 50, right: 48 }
  const chartW = w - pad.left - pad.right
  const chartH = h - pad.top - pad.bottom

  const { start, end } = getVisibleRange()
  view.startIndex = start
  view.endIndex = end

  let slice: Array<KLineData | TickData>
  if (isRealtimeMode() && props.tickData && props.tickData.length > 0) {
    slice = props.tickData.slice(start, end)
  } else if (isRealtimeMode() && props.data.length > 0) {
    slice = props.data.slice(start, end)
  } else {
    slice = props.data.slice(start, end)
  }
  if (slice.length < 1) return

  const openPrice = getOpenBaseline(slice)
  const prices = getPrices(slice)
  const volumes = getVolumes(slice)

  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const absRange = maxPrice - minPrice || 1
  const pricePad = absRange * 0.08
  const yMin = minPrice - pricePad
  const yMax = maxPrice + pricePad
  const yRange = yMax - yMin

  const klineH = chartH * 0.70
  const volH = chartH * 0.30
  const volTop = pad.top + klineH + 2
  const toY = (v: number) => pad.top + ((yMax - v) / yRange) * klineH
  const openY = toY(openPrice)

  ctx.fillStyle = tc.bg
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = tc.grid
  ctx.lineWidth = 0.5
  const gridRows = 5
  for (let i = 0; i <= gridRows; i++) {
    const y = pad.top + (klineH / gridRows) * i
    ctx.beginPath()
    ctx.moveTo(pad.left, y)
    ctx.lineTo(pad.left + chartW, y)
    ctx.stroke()

    const priceVal = yMax - (yRange / gridRows) * i

    ctx.fillStyle = tc.text
    ctx.font = '9px -apple-system, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(priceVal.toFixed(2), pad.left - 4, y + 3)

    if (openPrice > 0) {
      const pct = ((priceVal - openPrice) / openPrice) * 100
      ctx.textAlign = 'left'
      const sign = pct >= 0 ? '+' : ''
      ctx.fillText(`${sign}${pct.toFixed(2)}%`, pad.left + chartW + 4, y + 3)
    }
  }

  ctx.strokeStyle = tc.zeroLine
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(pad.left, openY)
  ctx.lineTo(pad.left + chartW, openY)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.strokeStyle = tc.grid
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(pad.left, volTop)
  ctx.lineTo(pad.left + chartW, volTop)
  ctx.stroke()

  const maxVol = Math.max(...volumes) || 1
  const gridVolRows = 2
  for (let i = 1; i <= gridVolRows; i++) {
    const y = volTop + (volH / gridVolRows) * i
    ctx.beginPath()
    ctx.setLineDash([2, 4])
    ctx.moveTo(pad.left, y)
    ctx.lineTo(pad.left + chartW, y)
    ctx.stroke()
    ctx.setLineDash([])
  }

  if (isRealtimeMode()) {
    const tickSlice = slice as TickData[]

    const pts: { x: number; y: number }[] = []
    for (const t of tickSlice) {
      pts.push({ x: realtimeTimeToX(t.time, chartW, pad.left), y: toY(t.price) })
    }

    if (pts.length > 0) {
      const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + klineH)
      grad.addColorStop(0, 'rgba(26,115,232,0.15)')
      grad.addColorStop(1, 'rgba(26,115,232,0.01)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pad.top + klineH)
      for (const p of pts) ctx.lineTo(p.x, p.y)
      ctx.lineTo(pts[pts.length - 1].x, pad.top + klineH)
      ctx.closePath()
      ctx.fill()

      ctx.strokeStyle = '#1a73e8'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
      ctx.stroke()
    }

    const lunchLineX = pad.left + chartW * 0.5
    ctx.strokeStyle = tc.grid
    ctx.lineWidth = 0.5
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(lunchLineX, pad.top)
    ctx.lineTo(lunchLineX, pad.top + klineH)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.fillStyle = tc.text
    ctx.font = '9px -apple-system, sans-serif'
    ctx.textAlign = 'center'
    const labels = ['09:30', '10:30', '11:30/13:00', '14:00', '15:00']
    const fracs  = [0, 0.25, 0.5, 0.75, 1]
    for (let i = 0; i < labels.length; i++) {
      ctx.fillText(labels[i], pad.left + fracs[i] * chartW, h - 4)
    }

    const buckets = new Map<string, { vol: number; up: boolean }>()
    for (const t of tickSlice) {
      const key = t.time.slice(0, 5)
      const e = buckets.get(key)
      if (e) {
        e.vol += t.volume
      } else {
        buckets.set(key, { vol: t.volume, up: t.price >= (buckets.size === 0 ? t.price : 0) })
      }
    }
    const minW = Math.max(1, chartW * 0.5 / 121)
    for (const [key, e] of buckets) {
      const bx = realtimeTimeToX(key + ':00', chartW, pad.left)
      const vh = e.vol / maxVol * volH * 0.9
      ctx.fillStyle = e.up ? tc.volUp : tc.volDown
      ctx.fillRect(bx - minW / 2, volTop + volH - vh, minW, vh)
    }
  } else {
    const step = view.barWidth + view.barGap
    const bw = view.barWidth
    const candleW = Math.max(1, bw * 0.8)

    const kSlice = slice as KLineData[]

    for (let i = 0; i < kSlice.length; i++) {
      const d = kSlice[i]
      const x = pad.left + i * step + step / 2
      const isUp = d.close >= d.open
      const color = isUp ? tc.up : tc.down

      ctx.strokeStyle = color
      ctx.beginPath()
      ctx.moveTo(x, toY(d.high))
      ctx.lineTo(x, toY(d.low))
      ctx.stroke()

      const y1 = toY(d.open)
      const y2 = toY(d.close)
      const bodyH = Math.max(1, Math.abs(y2 - y1))
      ctx.fillStyle = color
      ctx.fillRect(x - candleW / 2, Math.min(y1, y2), candleW, bodyH)
    }

    const maColors: Record<string, string> = { MA5: '#f9ab00', MA10: '#4285f4', MA20: '#9334e6' }
    const closes = kSlice.map((d) => d.close)
    for (const [label, period] of [['MA5', 5], ['MA10', 10], ['MA20', 20]] as const) {
      const ma = calcMA(closes, period)
      ctx.strokeStyle = maColors[label]
      ctx.lineWidth = 0.8
      ctx.beginPath()
      let started = false
      for (let i = 0; i < ma.length; i++) {
        if (ma[i] === null) continue
        const x = pad.left + i * step + step / 2
        const y = toY(ma[i]!)
        if (!started) { ctx.moveTo(x, y); started = true } else ctx.lineTo(x, y)
      }
      ctx.stroke()

      const lastValid = ma.filter((v) => v !== null).pop()
      if (lastValid !== undefined && lastValid !== null) {
        ctx.fillStyle = maColors[label]
        ctx.font = '8px -apple-system, sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText(label, pad.left + (ma.length - 1) * step + step / 2 + 4, toY(lastValid) + 3)
      }
    }

    for (let i = 0; i < kSlice.length; i++) {
      const d = kSlice[i]
      const x = pad.left + i * step + step / 2
      const vh = d.volume / maxVol * volH * 0.9
      ctx.fillStyle = d.close >= d.open ? tc.volUp : tc.volDown
      ctx.fillRect(x - candleW / 2, volTop + volH - vh, candleW, vh)
    }

    ctx.fillStyle = tc.text
    ctx.font = '9px -apple-system, sans-serif'
    ctx.textAlign = 'center'
    const labelStep = Math.max(1, Math.floor(kSlice.length / 5))
    for (let i = 0; i < kSlice.length; i += labelStep) {
      ctx.fillText(kSlice[i].date.slice(5), pad.left + i * step + step / 2, h - 4)
    }
  }

  if (crosshair.visible) {
    const cx = crosshair.x
    const cy = crosshair.y

    ctx.strokeStyle = tc.text
    ctx.lineWidth = 0.5
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(cx, pad.top)
    ctx.lineTo(cx, pad.top + klineH)
    ctx.stroke()
    ctx.beginPath()
    const priceY = toY(crosshair.price)
    ctx.moveTo(pad.left, priceY)
    ctx.lineTo(pad.left + chartW, priceY)
    ctx.stroke()
    ctx.setLineDash([])

    const tooltipW = 130
    const tooltipH = isCandleMode() ? 112 : 40
    let tx = cx + 14
    let ty = cy - tooltipH - 10
    if (tx + tooltipW > w - 4) tx = cx - tooltipW - 14
    if (ty < 4) ty = cy + 14
    if (ty + tooltipH > h - 4) ty = h - tooltipH - 4

    ctx.fillStyle = tc.tooltipBg
    ctx.fillRect(tx, ty, tooltipW, tooltipH)

    ctx.fillStyle = tc.tooltipText
    ctx.font = '10px -apple-system, sans-serif'
    ctx.textAlign = 'left'

    let rowY = ty + 14
    ctx.fillText(`${crosshair.dateLabel}`, tx + 6, rowY)
    rowY += 16
    ctx.fillText(`价格: ${crosshair.price.toFixed(2)}`, tx + 6, rowY)

    if (isCandleMode()) {
      const idx = crosshair.index
      const kSlice = (slice as KLineData[])
      if (idx >= 0 && idx < kSlice.length) {
        const kd = kSlice[idx]
        rowY += 16; ctx.fillText(`开: ${kd.open}`, tx + 6, rowY)
        rowY += 16; ctx.fillText(`高: ${kd.high}`, tx + 6, rowY)
        rowY += 16; ctx.fillText(`低: ${kd.low}`, tx + 6, rowY)
        rowY += 16; ctx.fillText(`收: ${kd.close}`, tx + 6, rowY)
      }
    }
  }
}

function scheduleDraw() {
  if (animFrameId !== null) cancelAnimationFrame(animFrameId)
  animFrameId = requestAnimationFrame(() => { animFrameId = null; draw() })
}

function onMouseMove(e: MouseEvent) {
  if (isDragging) {
    if (isRealtimeMode()) return
    const dx = e.clientX - dragStartX
    view.offsetX = dragStartOffset + dx
    scheduleDraw()
    return
  }
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top

  const pad = { left: 50, right: 48 }
  const chartW = canvas.clientWidth - pad.left - pad.right
  if (mx < pad.left || mx > pad.left + chartW) {
    crosshair.visible = false
    scheduleDraw()
    return
  }

  if (isRealtimeMode() && props.tickData) {
    const ticks = props.tickData
    let best = -1
    let bestDist = Infinity
    for (let i = 0; i < ticks.length; i++) {
      const tx = realtimeTimeToX(ticks[i].time, chartW, pad.left)
      const d = Math.abs(tx - mx)
      if (d < bestDist) { bestDist = d; best = i }
    }
    if (best >= 0) {
      const t = ticks[best]
      crosshair.visible = true
      crosshair.x = realtimeTimeToX(t.time, chartW, pad.left)
      crosshair.y = my
      crosshair.price = t.price
      crosshair.dateLabel = t.time
      crosshair.index = best
      crosshair.openPrice = ticks[0]?.price ?? 0
      crosshair.changePercent = crosshair.openPrice > 0 ? ((t.price - crosshair.openPrice) / crosshair.openPrice) * 100 : 0
    } else {
      crosshair.visible = false
    }
    scheduleDraw()
    return
  }

  const { start } = getVisibleRange()
  const step = view.barWidth + view.barGap
  const slice = props.data.slice(start, view.endIndex)

  const idx = Math.floor((mx - pad.left) / step)
  if (idx >= 0 && idx < slice.length) {
    const kd = slice[idx]
    crosshair.visible = true
    crosshair.x = pad.left + idx * step + step / 2
    crosshair.y = my
    crosshair.price = kd.close
    crosshair.openPrice = slice[0]?.open ?? 0
    crosshair.changePercent = crosshair.openPrice > 0 ? ((kd.close - crosshair.openPrice) / crosshair.openPrice) * 100 : 0
    crosshair.dateLabel = kd.date
    crosshair.index = idx
  } else {
    crosshair.visible = false
  }
  scheduleDraw()
}

function onMouseLeave() {
  crosshair.visible = false
  if (!isDragging) scheduleDraw()
}

function onMouseUp() {
  if (!isDragging) return
  isDragging = false
  if (canvasRef.value) canvasRef.value.style.cursor = 'crosshair'
  window.removeEventListener('mouseup', onMouseUp)
}

function onMouseDown(e: MouseEvent) {
  if (isRealtimeMode()) return
  isDragging = true
  dragStartX = e.clientX
  dragStartOffset = view.offsetX
  if (canvasRef.value) canvasRef.value.style.cursor = 'grabbing'
  window.addEventListener('mouseup', onMouseUp)
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  if (isRealtimeMode()) return
  const delta = e.deltaY > 0 ? 0.5 : -0.5
  view.barWidth = Math.max(2, Math.min(20, view.barWidth + delta))
  view.barGap = Math.max(0.5, view.barWidth * 0.2)
  scheduleDraw()
}

function onResize() {
  scheduleDraw()
}

onMounted(() => {
  nextTick(() => scheduleDraw())
  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => onResize())
    resizeObserver.observe(containerRef.value)
  }
  if (canvasRef.value) {
    canvasRef.value.addEventListener('wheel', onWheel, { passive: false })
  }
})

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect()
  if (animFrameId !== null) cancelAnimationFrame(animFrameId)
  window.removeEventListener('mouseup', onMouseUp)
})

watch(
  () => props.mode,
  () => {
    view.offsetX = 0
    nextTick(() => scheduleDraw())
  }
)

watch(
  () => [props.data, props.tickData] as const,
  () => {
    nextTick(() => scheduleDraw())
  },
  { deep: true }
)

watch(isDark, () => {
  nextTick(() => scheduleDraw())
})
</script>

<template>
  <div ref="containerRef" class="kline-chart" :style="{ height: height || '100%' }">
    <canvas
      ref="canvasRef"
      class="kline-canvas"
      @mousemove="onMouseMove"
      @mouseleave="onMouseLeave"
      @mousedown="onMouseDown"
      @mouseup="onMouseUp"
    />
  </div>
</template>

<style scoped>
.kline-chart {
  width: 100%;
  min-height: 300px;
  position: relative;
  background: var(--chart-bg);
  border-radius: 4px;
  overflow: hidden;
}

.kline-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  cursor: crosshair;
}
</style>
