<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useTheme } from '@/composables/useTheme'
import type { KLineData } from '@/data/mock'

const props = defineProps<{
  data: KLineData[]
  symbol?: string
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

type Crosshair = { visible: boolean; x: number; index: number; price: number }

let view: ViewState = { startIndex: 0, endIndex: 0, barWidth: 6, barGap: 1, offsetX: 0 }
let crosshair: Crosshair = { visible: false, x: 0, index: 0, price: 0 }
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
        volUp: 'rgba(248,81,73,0.25)',
        volDown: 'rgba(63,185,80,0.25)',
        tooltipBg: '#e6edf3',
        tooltipText: '#0d1117',
      }
    : {
        bg: '#fafbfc',
        grid: '#e8eaed',
        text: '#5f6368',
        up: '#d93025',
        down: '#188038',
        volUp: 'rgba(217,48,37,0.3)',
        volDown: 'rgba(24,128,56,0.3)',
        tooltipBg: '#202124',
        tooltipText: '#ffffff',
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

function getVisibleRange() {
  const canvas = canvasRef.value
  if (!canvas) return { start: 0, end: props.data.length }
  const chartW = canvas.clientWidth - 60
  const visibleCount = Math.floor(chartW / (view.barWidth + view.barGap))
  const maxStart = Math.max(0, props.data.length - visibleCount)
  const offsetBars = Math.round(Math.abs(view.offsetX) / (view.barWidth + view.barGap))
  const start = Math.min(maxStart, offsetBars)
  const end = Math.min(props.data.length, start + visibleCount)
  return { start, end }
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

  const { start, end } = getVisibleRange()
  view.startIndex = start
  view.endIndex = end

  const slice = props.data.slice(start, end)
  if (slice.length < 1) return

  const pad = { top: 8, right: 52, bottom: 24 }
  const chartW = w - pad.right
  const chartH = h - pad.top - pad.bottom
  const klineH = chartH * 0.72
  const volH = chartH * 0.28
  const volTop = pad.top + klineH + 2

  const bw = view.barWidth
  const gap = view.barGap
  const step = bw + gap

  const prices = slice.flatMap((d) => [d.high, d.low])
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const priceRange = maxPrice - minPrice || 1
  const pricePad = priceRange * 0.05
  const yMin = minPrice - pricePad
  const yMax = maxPrice + pricePad
  const yRange = yMax - yMin

  const toY = (v: number) => pad.top + klineH - ((v - yMin) / yRange) * klineH

  const volumes = slice.map((d) => d.volume)
  const maxVol = Math.max(...volumes) || 1

  ctx.fillStyle = tc.bg
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = tc.grid
  ctx.lineWidth = 0.5
  const gridRows = 5
  for (let i = 0; i <= gridRows; i++) {
    const y = pad.top + (klineH / gridRows) * i
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(chartW, y)
    ctx.stroke()

    const p = yMax - (yRange / gridRows) * i
    ctx.fillStyle = tc.text
    ctx.font = '9px -apple-system, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(p.toFixed(2), w - 2, y + 3)
  }

  ctx.strokeStyle = tc.grid
  ctx.beginPath()
  ctx.moveTo(0, volTop)
  ctx.lineTo(chartW, volTop)
  ctx.stroke()

  const gridVolRows = 2
  for (let i = 1; i <= gridVolRows; i++) {
    const y = volTop + (volH / gridVolRows) * i
    ctx.beginPath()
    ctx.setLineDash([2, 4])
    ctx.moveTo(0, y)
    ctx.lineTo(chartW, y)
    ctx.stroke()
    ctx.setLineDash([])
  }

  for (let i = 0; i < slice.length; i++) {
    const d = slice[i]
    const x = i * step + step / 2
    const isUp = d.close >= d.open
    const color = isUp ? tc.up : tc.down
    const candleW = Math.max(1, bw * 0.8)

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

    const volHBar = (d.volume / maxVol) * volH * 0.9
    ctx.fillStyle = isUp ? tc.volUp : tc.volDown
    ctx.fillRect(x - candleW / 2, volTop + volH - volHBar, candleW, volHBar)
  }

  const maColors: Record<string, string> = { MA5: '#f9ab00', MA10: '#4285f4', MA20: '#9334e6' }
  const closes = slice.map((d) => d.close)
  for (const [label, period] of [['MA5', 5], ['MA10', 10], ['MA20', 20]] as const) {
    const ma = calcMA(closes, period)
    ctx.strokeStyle = maColors[label]
    ctx.lineWidth = 0.8
    ctx.setLineDash([])
    ctx.beginPath()
    let started = false
    for (let i = 0; i < ma.length; i++) {
      if (ma[i] === null) continue
      const x = i * step + step / 2
      const y = toY(ma[i]!)
      if (!started) { ctx.moveTo(x, y); started = true } else ctx.lineTo(x, y)
    }
    ctx.stroke()

    const lastValid = ma.filter((v) => v !== null).pop()
    if (lastValid !== undefined && lastValid !== null) {
      const labelX = (ma.length - 1) * step + step / 2 + 4
      const labelY = toY(lastValid)
      ctx.fillStyle = maColors[label]
      ctx.font = '8px -apple-system, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(label, labelX, labelY + 3)
    }
  }

  const labelStep = Math.max(1, Math.floor(slice.length / 5))
  ctx.fillStyle = tc.text
  ctx.font = '9px -apple-system, sans-serif'
  ctx.textAlign = 'center'
  for (let i = 0; i < slice.length; i += labelStep) {
    const x = i * step + step / 2
    const label = slice[i].date.slice(5)
    ctx.fillText(label, x, h - 4)
  }

  if (crosshair.visible) {
    ctx.strokeStyle = tc.text
    ctx.lineWidth = 0.5
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(crosshair.x, pad.top)
    ctx.lineTo(crosshair.x, pad.top + chartH)
    ctx.stroke()
    ctx.beginPath()
    const cy = toY(crosshair.price)
    ctx.moveTo(0, cy)
    ctx.lineTo(chartW, cy)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.fillStyle = tc.tooltipBg
    const tooltipW = 130
    const tooltipH = 36
    const tx = crosshair.x > chartW / 2 ? crosshair.x - tooltipW - 8 : crosshair.x + 8
    ctx.fillRect(tx, pad.top, tooltipW, tooltipH)
    ctx.fillStyle = tc.tooltipText
    ctx.font = '10px -apple-system, sans-serif'
    ctx.textAlign = 'left'
    const idx = crosshair.index
    if (idx >= 0 && idx < slice.length) {
      const d = slice[idx]
      ctx.fillText(`O:${d.open} H:${d.high}`, tx + 6, pad.top + 12)
      ctx.fillText(`L:${d.low} C:${d.close}`, tx + 6, pad.top + 26)
    }
  }
}

function scheduleDraw() {
  if (animFrameId !== null) cancelAnimationFrame(animFrameId)
  animFrameId = requestAnimationFrame(() => { animFrameId = null; draw() })
}

function onMouseMove(e: MouseEvent) {
  if (isDragging) {
    const dx = e.clientX - dragStartX
    view.offsetX = dragStartOffset - dx
    scheduleDraw()
    return
  }
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const padRight = 52
  const chartW = canvas.clientWidth - padRight
  if (mx > chartW) { crosshair.visible = false; scheduleDraw(); return }

  const { start } = getVisibleRange()
  const step = view.barWidth + view.barGap
  const idx = Math.floor(mx / step)
  const visibleSlice = props.data.slice(start, view.endIndex)
  if (idx >= 0 && idx < visibleSlice.length) {
    crosshair.visible = true
    crosshair.x = idx * step + step / 2
    crosshair.price = visibleSlice[idx].close
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

function onMouseDown(e: MouseEvent) {
  isDragging = true
  dragStartX = e.clientX
  dragStartOffset = view.offsetX
  if (canvasRef.value) canvasRef.value.style.cursor = 'grabbing'
}

function onMouseUp() {
  isDragging = false
  if (canvasRef.value) canvasRef.value.style.cursor = 'crosshair'
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
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
})

watch(
  () => props.data,
  () => {
    view.offsetX = 0
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
