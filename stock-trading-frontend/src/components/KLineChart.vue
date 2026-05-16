<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useTheme } from '@/composables/useTheme'
import type { ChartMode } from '@/types'
import type { KLineRow, TickPoint } from '@/composables/useSimulation'

const props = defineProps<{
  data: KLineRow[]
  tickData?: TickPoint[]
  mode?: ChartMode
  height?: string
  preClose?: number
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
        volUp: 'rgba(248,81,73,0.28)',
        volDown: 'rgba(63,185,80,0.28)',
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
        volUp: 'rgba(217,48,37,0.28)',
        volDown: 'rgba(24,128,56,0.28)',
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

function formatVolume(vol: number): string {
  if (vol >= 1e8) return (vol / 1e8).toFixed(2) + '亿'
  if (vol >= 1e4) return (vol / 1e4).toFixed(2) + '万'
  return Math.round(vol).toString()
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function formatTurnover(amount: number): string {
  if (amount >= 1e8) return (amount / 1e8).toFixed(2) + '亿'
  if (amount >= 1e4) return (amount / 1e4).toFixed(2) + '万'
  return Math.round(amount).toString()
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

  const fitStep = 6 + 1
  const defaultVisible = Math.floor(chartW / fitStep)
  if (total <= defaultVisible) {
    const currentStep = view.barWidth + view.barGap
    const currentVisible = Math.floor(chartW / currentStep)
    if (total <= currentVisible) {
      return { start: 0, end: total }
    }
  }

  const step = view.barWidth + view.barGap
  const visibleCount = Math.floor(chartW / step)
  const maxStart = Math.max(0, total - visibleCount)
  const offsetBars = Math.round(Math.max(0, view.offsetX) / step)
  const start = Math.max(0, maxStart - offsetBars)
  const end = Math.min(total, start + visibleCount)
  return { start, end }
}

function getOpenBaseline(slice: Array<KLineRow | TickPoint>): number {
  if (props.preClose && props.preClose > 0) return props.preClose
  if (isRealtimeMode()) {
    const tickSlice = slice as TickPoint[]
    if (tickSlice.length > 0) return tickSlice[0].price
    return 0
  }
  const kSlice = slice as KLineRow[]
  if (kSlice.length > 0) return kSlice[0].open
  return 0
}

function getPrices(slice: Array<KLineRow | TickPoint>): number[] {
  if (isRealtimeMode()) return (slice as TickPoint[]).map((d) => d.price)
  return (slice as KLineRow[]).flatMap((d) => [d.high, d.low])
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

  let slice: Array<KLineRow | TickPoint>
  if (isRealtimeMode() && props.tickData && props.tickData.length > 0) {
    slice = props.tickData.slice(start, end)
  } else if (isRealtimeMode() && props.data.length > 0) {
    slice = props.data.slice(start, end)
  } else {
    slice = props.data.slice(start, end)
  }
  if (slice.length < 1) return

  const baseline = getOpenBaseline(slice)
  const prices = getPrices(slice)

  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)

  let yMin: number, yMax: number, yRange: number, pricePad: number, scaleSteps: number

  if (baseline <= 0) {
    yMin = minPrice * 0.98
    yMax = maxPrice * 1.02
    yRange = yMax - yMin || 1
    pricePad = yRange * 0.08
    yMin -= pricePad
    yMax += pricePad
    scaleSteps = 2
  } else {
    const maxPctUp = (maxPrice - baseline) / baseline * 100
    const minPctDown = (baseline - minPrice) / baseline * 100
    scaleSteps = 2
    while (maxPctUp > scaleSteps || minPctDown > scaleSteps) {
      scaleSteps += 1
    }
    yMin = baseline * (1 - scaleSteps / 100)
    yMax = baseline * (1 + scaleSteps / 100)
    yRange = yMax - yMin || 1
    pricePad = 0
  }

  const isCandle = isCandleMode()
  const volGap = 14
  const klineH = chartH * 0.72
  const volTop = pad.top + klineH + volGap
  const volH = chartH - klineH - volGap
  const toY = (v: number) => pad.top + ((yMax - v) / yRange) * klineH

  let pctBaseline = baseline
  if (isCandle) {
    const kSlice = slice as KLineRow[]
    if (kSlice.length > 0) pctBaseline = kSlice[0].close
  }
  const baselineY = toY(pctBaseline)

  ctx.fillStyle = tc.bg
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = tc.grid
  ctx.lineWidth = 0.5
  const gridRows = scaleSteps * 2
  const baselineIdx = scaleSteps
  let displayStep = 1
  if (gridRows + 1 > 10) {
    displayStep = 1
    while (baselineIdx % displayStep !== 0 || gridRows / displayStep + 1 > 10) {
      displayStep++
    }
  }
  for (let i = 0; i <= gridRows; i += displayStep) {
    const y = pad.top + (klineH / gridRows) * i
    ctx.beginPath()
    ctx.moveTo(pad.left, y)
    ctx.lineTo(pad.left + chartW, y)
    ctx.stroke()

    const priceVal = yMax - (yRange / gridRows) * i

    ctx.fillStyle = tc.text
    ctx.font = '10px -apple-system, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(priceVal.toFixed(2), pad.left - 4, y + 3)

    if (pctBaseline > 0) {
      const pct = ((priceVal - pctBaseline) / pctBaseline) * 100
      ctx.textAlign = 'left'
      const sign = pct >= 0 ? '+' : ''
      ctx.fillText(`${sign}${pct.toFixed(2)}%`, pad.left + chartW + 4, y + 3)
    }
  }

  ctx.strokeStyle = tc.zeroLine
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(pad.left, baselineY)
  ctx.lineTo(pad.left + chartW, baselineY)
  ctx.stroke()
  ctx.setLineDash([])

  if (isRealtimeMode()) {
    const tickSlice = slice as TickPoint[]

    const pts: { x: number; y: number }[] = []
    for (const t of tickSlice) {
      pts.push({ x: realtimeTimeToX(t.time, chartW, pad.left), y: toY(t.price) })
    }

    if (pts.length > 0) {
      const lastPrice = tickSlice[tickSlice.length - 1]?.price ?? baseline
      const isUp = lastPrice >= baseline
      const lineColor = isUp ? tc.up : tc.down
      const bottomY = pad.top + klineH

      const r = parseInt(lineColor.slice(1, 3), 16)
      const g = parseInt(lineColor.slice(3, 5), 16)
      const b = parseInt(lineColor.slice(5, 7), 16)

      const areaGrad = ctx.createLinearGradient(0, pad.top, 0, bottomY)
      areaGrad.addColorStop(0, `rgba(${r},${g},${b},0.22)`)
      areaGrad.addColorStop(0.55, `rgba(${r},${g},${b},0.05)`)
      areaGrad.addColorStop(1, `rgba(${r},${g},${b},0.0)`)

      ctx.fillStyle = areaGrad
      ctx.beginPath()
      ctx.moveTo(pts[0].x, bottomY)
      for (let i = 0; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
      ctx.lineTo(pts[pts.length - 1].x, bottomY)
      ctx.closePath()
      ctx.fill()

      ctx.strokeStyle = lineColor
      ctx.lineWidth = 1.5
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
      ctx.stroke()

      const lastPt = pts[pts.length - 1]
      ctx.fillStyle = lineColor
      ctx.beginPath()
      ctx.arc(lastPt.x, lastPt.y, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = tc.bg
      ctx.lineWidth = 1.5
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

    ctx.strokeStyle = tc.grid
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(pad.left, volTop - volGap / 2)
    ctx.lineTo(pad.left + chartW, volTop - volGap / 2)
    ctx.stroke()

    const tickVolumes = tickSlice.map((_t, i) => Math.floor(1000000 + seededRandom(i * 7919) * 4000000))
    const realMaxVol = Math.max(...tickVolumes, 1)

    const volGridRows = 2
    for (let i = 0; i <= volGridRows; i++) {
      const y = volTop + (volH / volGridRows) * i
      ctx.beginPath()
      ctx.moveTo(pad.left, y)
      ctx.lineTo(pad.left + chartW, y)
      ctx.stroke()

      const volVal = realMaxVol - (realMaxVol / volGridRows) * i
      ctx.fillStyle = tc.text
      ctx.font = '10px -apple-system, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(formatVolume(volVal), pad.left - 4, y + 3)
    }

    for (let i = 0; i < tickSlice.length; i++) {
      const x = realtimeTimeToX(tickSlice[i].time, chartW, pad.left)
      const prevPrice = i > 0 ? tickSlice[i - 1].price : baseline
      const isVolUp = tickSlice[i].price >= prevPrice
      const barH = (tickVolumes[i] / realMaxVol) * volH
      const barY = volTop + volH - barH
      const barW = Math.max(1, Math.min(chartW * 0.7 / 240, chartW * 0.7 / tickSlice.length))
      ctx.fillStyle = isVolUp ? tc.volUp : tc.volDown
      ctx.fillRect(x - barW / 2, barY, barW, Math.max(1, barH))
    }

    ctx.fillStyle = tc.text
    ctx.font = '10px -apple-system, sans-serif'
    ctx.textAlign = 'center'
    const labels = ['09:30', '10:30', '11:30/13:00', '14:00', '15:00']
    const fracs  = [0, 0.25, 0.5, 0.75, 1]
    for (let i = 0; i < labels.length; i++) {
      ctx.fillText(labels[i], pad.left + fracs[i] * chartW, h - 4)
    }

  } else {
    const step = view.barWidth + view.barGap
    const bw = view.barWidth
    const candleW = Math.max(1, bw * 0.8)

    const kSlice = slice as KLineRow[]

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
        ctx.font = '10px -apple-system, sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText(label, pad.left + (ma.length - 1) * step + step / 2 + 4, toY(lastValid) + 3)
      }
    }

    ctx.fillStyle = tc.text
    ctx.font = '10px -apple-system, sans-serif'
    ctx.textAlign = 'center'
    const labelStep = Math.max(1, Math.floor(kSlice.length / 5))
    for (let i = 0; i < kSlice.length; i += labelStep) {
      ctx.fillText(kSlice[i].date.slice(5), pad.left + i * step + step / 2, h - 4)
    }

    ctx.strokeStyle = tc.grid
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(pad.left, volTop - volGap / 2)
    ctx.lineTo(pad.left + chartW, volTop - volGap / 2)
    ctx.stroke()

    const volumes = kSlice.map((d) => d.volume)
    const maxVol = Math.max(...volumes, 1)

    const volGridRows = 2
    for (let i = 0; i <= volGridRows; i++) {
      const y = volTop + (volH / volGridRows) * i
      ctx.beginPath()
      ctx.moveTo(pad.left, y)
      ctx.lineTo(pad.left + chartW, y)
      ctx.stroke()

      const volVal = maxVol - (maxVol / volGridRows) * i
      ctx.fillStyle = tc.text
      ctx.font = '10px -apple-system, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(formatVolume(volVal), pad.left - 4, y + 3)
    }

    for (let i = 0; i < kSlice.length; i++) {
      const d = kSlice[i]
      const x = pad.left + i * step + step / 2
      const isUp = d.close >= d.open

      const barH = (d.volume / maxVol) * volH
      const barY = volTop + volH - barH

      ctx.fillStyle = isUp ? tc.volUp : tc.volDown
      ctx.fillRect(x - candleW / 2, barY, candleW, Math.max(1, barH))
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

    let changeBase = crosshair.openPrice
    if (isCandleMode()) {
      const kSlice = slice as KLineRow[]
      const ci = crosshair.index
      if (ci > 0 && ci < kSlice.length) {
        changeBase = kSlice[ci - 1].close
      } else if (ci === 0 && kSlice.length > 0) {
        changeBase = kSlice[0].open
      }
    }
    const changeAmount = crosshair.price - changeBase
    const changePct = changeBase > 0 ? (changeAmount / changeBase) * 100 : 0
    const isPriceUp = changeAmount >= 0

    const seedBase = crosshair.dateLabel.charCodeAt(0) * 1000 + (crosshair.dateLabel.charCodeAt(crosshair.dateLabel.length - 1) || 0) + crosshair.index * 7919
    const mockVolume = Math.floor(1000000 + seededRandom(seedBase) * 4000000)
    const mockTurnover = Math.floor(2000000000 + seededRandom(seedBase + 1) * 13000000000)

    const isCandle = isCandleMode()
    const tooltipW = 180
    const rowCount = isCandle ? 9 : 6
    const rowH = 16
    const tooltipH = 10 + rowCount * rowH + 8
    let tx = cx + 14
    let ty = cy - tooltipH - 10
    if (tx + tooltipW > w - 4) tx = cx - tooltipW - 14
    if (ty < 4) ty = cy + 14
    if (ty + tooltipH > h - 4) ty = h - tooltipH - 4

    const radius = 5

    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.15)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 2

    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.moveTo(tx + radius, ty)
    ctx.lineTo(tx + tooltipW - radius, ty)
    ctx.arcTo(tx + tooltipW, ty, tx + tooltipW, ty + radius, radius)
    ctx.lineTo(tx + tooltipW, ty + tooltipH - radius)
    ctx.arcTo(tx + tooltipW, ty + tooltipH, tx + tooltipW - radius, ty + tooltipH, radius)
    ctx.lineTo(tx + radius, ty + tooltipH)
    ctx.arcTo(tx, ty + tooltipH, tx, ty + tooltipH - radius, radius)
    ctx.lineTo(tx, ty + radius)
    ctx.arcTo(tx, ty, tx + radius, ty, radius)
    ctx.closePath()
    ctx.fill()
    ctx.restore()

    ctx.font = '10px -apple-system, sans-serif'

    ctx.fillStyle = '#666666'
    ctx.textAlign = 'left'
    let rowY = ty + 14
    ctx.fillText(crosshair.dateLabel, tx + 8, rowY)
    rowY += rowH

    function drawRow(label: string, valueText: string, valueColor: string) {
      ctx!.fillStyle = '#666666'
      ctx!.textAlign = 'left'
      ctx!.fillText(label, tx + 8, rowY)
      ctx!.fillStyle = valueColor
      ctx!.textAlign = 'right'
      ctx!.fillText(valueText, tx + tooltipW - 8, rowY)
      rowY += rowH
    }

    const upColor = '#d93025'
    const downColor = '#188038'
    const priceColor = isPriceUp ? upColor : downColor

    if (!isCandle) {
      drawRow('价格', crosshair.price.toFixed(2), priceColor)
    }
    drawRow('涨跌额', (changeAmount >= 0 ? '+' : '') + changeAmount.toFixed(2), priceColor)
    drawRow('涨跌幅', (changePct >= 0 ? '+' : '') + changePct.toFixed(2) + '%', priceColor)
    drawRow('成交量', formatVolume(mockVolume) + '手', '#222222')
    drawRow('成交额', formatTurnover(mockTurnover), '#222222')

    if (isCandle) {
      const idx = crosshair.index
      const kSlice = (slice as KLineRow[])
      if (idx >= 0 && idx < kSlice.length) {
        const kd = kSlice[idx]
        const kdUp = kd.close >= kd.open
        const kdColor = kdUp ? upColor : downColor
        drawRow('开盘', kd.open.toFixed(2), kdColor)
        drawRow('最高', kd.high.toFixed(2), kdColor)
        drawRow('最低', kd.low.toFixed(2), kdColor)
        drawRow('收盘', kd.close.toFixed(2), kdColor)
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
      crosshair.dateLabel = t.time.slice(0, 5)
      crosshair.index = best
      crosshair.openPrice = props.preClose ?? ticks[0]?.price ?? 0
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
  window.removeEventListener('mousemove', onMouseMove)
}

function onMouseDown(e: MouseEvent) {
  if (isRealtimeMode()) return
  isDragging = true
  dragStartX = e.clientX
  dragStartOffset = view.offsetX
  if (canvasRef.value) canvasRef.value.style.cursor = 'grabbing'
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('mousemove', onMouseMove)
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  if (isRealtimeMode()) return

  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const pad = { left: 50, right: 48 }
  const mouseCanvasX = e.clientX - rect.left - pad.left

  const oldStep = view.barWidth + view.barGap
  const barIndex = Math.floor((mouseCanvasX + view.offsetX) / oldStep)

  const delta = e.deltaY > 0 ? -0.5 : 0.5
  view.barWidth = Math.max(2, Math.min(20, view.barWidth + delta))
  view.barGap = Math.max(0.5, view.barWidth * 0.2)

  const newStep = view.barWidth + view.barGap
  view.offsetX = Math.max(0, barIndex * newStep - mouseCanvasX)

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
  window.removeEventListener('mousemove', onMouseMove)
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
