<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { ChartMode } from '@/data/mock'
import type { Order } from '@/types'
import KLineChart from '@/components/KLineChart.vue'
import { useSimulation } from '@/composables/useSimulation'
import { useOrderStore } from '@/stores/order'
import { usePositionStore } from '@/stores/position'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/services/api'

const route = useRoute()
const router = useRouter()
const orderStore = useOrderStore()
const positionStore = usePositionStore()
const authStore = useAuthStore()

const {
  currentTime,
  currentDate,
  currentPrices,
  stockRefs,
  stockTicks,
  dailyKLines,
  weeklyKLines,
  monthlyKLines,
} = useSimulation()

const stockCode = computed(() => route.params.code as string)

const stockInfo = computed(() => {
  const ref = stockRefs.value[stockCode.value]
  if (!ref) return null
  const price = currentPrices[stockCode.value] ?? ref.open
  const change = price - ref.open
  const changePercent = ref.open > 0 ? (change / ref.open) * 100 : 0
  return {
    code: ref.code,
    name: ref.name,
    price,
    change: +change.toFixed(2),
    changePercent: +changePercent.toFixed(2),
    volume: 0,
    high: ref.high,
    low: ref.low,
    open: ref.open,
    preClose: ref.preClose,
  }
})

function simpleHash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function toFloat(n: number, digits = 2): number {
  return +n.toFixed(digits)
}

function formatNum(n: number, digits = 2): string {
  if (n >= 1e8) return (n / 1e8).toFixed(digits) + '亿'
  if (n >= 1e4) return (n / 1e4).toFixed(digits) + '万'
  return n.toFixed(digits)
}

interface DepthLevel {
  price: number
  volume: number
}

interface SimulatedTrade {
  id: number
  time: string
  price: number
  volume: number
  type: 'buy' | 'sell'
}

function getPriceTick(price: number): number {
  if (price >= 100) return 0.05
  if (price >= 10) return 0.01
  return 0.001
}

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

const depthLevels = computed<{ bids: DepthLevel[]; asks: DepthLevel[] }>(() => {
  const price = stockInfo.value?.price ?? 0
  if (price <= 0) return { bids: [], asks: [] }

  const tick = getPriceTick(price)
  const hash = simpleHash(stockCode.value)
  const rnd = seededRandom(hash + Math.floor(Date.now() / 5000))

  const bids: DepthLevel[] = []
  for (let i = 0; i < 5; i++) {
    const offset = (i + 1) * tick + rnd() * tick * 0.5
    const vol = Math.floor(100 + rnd() * 5000 + i * 800)
    bids.push({ price: +(price - offset).toFixed(3), volume: vol - (vol % 100) })
  }

  const asks: DepthLevel[] = []
  for (let i = 0; i < 5; i++) {
    const offset = (i + 1) * tick + rnd() * tick * 0.5
    const vol = Math.floor(100 + rnd() * 5000 + i * 800)
    asks.push({ price: +(price + offset).toFixed(3), volume: vol - (vol % 100) })
  }

  return { bids, asks }
})

function getDepthPrecision(price: number): number {
  if (price >= 100) return 2
  if (price >= 10) return 2
  return 3
}

const MAX_TRADES = 15
const simulatedTrades = ref<SimulatedTrade[]>([])
let tradeSeq = 0
let tradeTimer: ReturnType<typeof setInterval> | null = null

function generateMockTrade() {
  const price = stockInfo.value?.price ?? 0
  if (price <= 0) return

  const tick = getPriceTick(price)
  const hash = simpleHash(stockCode.value)
  const rnd = seededRandom(hash * tradeSeq + Date.now())
  tradeSeq++

  const priceOffset = (rnd() - 0.5) * tick * 2
  const tradeType: 'buy' | 'sell' = rnd() > 0.5 ? 'buy' : 'sell'
  const volume = Math.floor((100 + rnd() * 2000) / 100) * 100

  const simTime = currentTime.value
  const timeStr = simTime.length >= 5 ? simTime.slice(0, 5) : simTime

  const trade: SimulatedTrade = {
    id: tradeSeq,
    time: timeStr,
    price: +(price + priceOffset).toFixed(getDepthPrecision(price)),
    volume,
    type: tradeType,
  }

  simulatedTrades.value = [trade, ...simulatedTrades.value].slice(0, MAX_TRADES)
}

function scheduleNextTrade() {
  if (!tradeTimer) return
  const delay = 1500 + Math.random() * 2500
  tradeTimer = setTimeout(() => {
    generateMockTrade()
    scheduleNextTrade()
  }, delay)
}

function startTradeSimulation() {
  stopTradeSimulation()
  tradeTimer = setTimeout(() => {
    generateMockTrade()
    scheduleNextTrade()
  }, 500)
}

function stopTradeSimulation() {
  if (tradeTimer) {
    clearTimeout(tradeTimer)
    tradeTimer = null
  }
}

onMounted(() => {
  startTradeSimulation()
})

onUnmounted(() => {
  stopTradeSimulation()
})

const stockDetail = computed(() => {
  const code = stockCode.value
  const ref = stockRefs.value[code]
  if (!ref) return null

  const ticks = stockTicks[code] || []
  const price = currentPrices[code] ?? ref.open
  const hash = simpleHash(code)

  const totalVolume = ticks.reduce((s, t) => s + t.volume, 0)
  const totalAmount = ticks.reduce((s, t) => s + t.price * t.volume, 0)

  const totalSharesBase = 100000000 + (hash % 100) * 100000000
  const totalShares = totalSharesBase
  const tradableRatio = 0.5 + (hash % 31) / 100
  const tradableShares = Math.floor(totalShares * tradableRatio)

  const turnoverRate = tradableShares > 0 ? (totalVolume / tradableShares) * 100 : 0
  const amplitude = ref.preClose > 0 ? ((ref.high - ref.low) / ref.preClose) * 100 : 0

  const peStatic = 8 + (hash % 37)
  const peTTM = peStatic * (0.85 + (hash % 31) / 100)
  const eps = price / peStatic
  const pb = 1.2 + (hash % 8) * 0.6
  const navPerShare = pb > 0 ? price / pb : price

  return {
    high: ref.high,
    low: ref.low,
    open: ref.open,
    preClose: ref.preClose,
    volume: totalVolume,
    amount: totalAmount,
    turnoverRate: toFloat(turnoverRate),
    amplitude: toFloat(amplitude),
    peStatic: toFloat(peStatic),
    peTTM: toFloat(peTTM),
    eps: toFloat(eps, 3),
    navPerShare: toFloat(navPerShare),
    tradableShares,
    totalShares,
    totalMarketCap: price * totalShares,
    tradableMarketCap: price * tradableShares,
    pb: toFloat(pb),
  }
})

const chartMode = ref<ChartMode>('realtime')

const klineData = computed(() => {
  const code = stockCode.value
  if (chartMode.value === 'day') return dailyKLines.value[code] || []
  if (chartMode.value === 'week') return weeklyKLines.value[code] || []
  if (chartMode.value === 'month') return monthlyKLines.value[code] || []
  return dailyKLines.value[code] || []
})

const tickData = computed(() => {
  if (chartMode.value === 'realtime') return stockTicks[stockCode.value] || []
  return []
})

function setMode(mode: ChartMode) {
  chartMode.value = mode
}

const stockOrders = computed<Order[]>(() =>
  orderStore.orders.filter((o) => o.stockCode === stockCode.value)
)

const buyOrders = computed(() =>
  stockOrders.value.filter((o) => o.type === 'buy')
)

const sellOrders = computed(() =>
  stockOrders.value.filter((o) => o.type === 'sell')
)

const pendingBuyCount = computed(() =>
  stockOrders.value.filter((o) => o.type === 'buy' && (o.status === 'pending' || o.status === 'partial'))
    .reduce((s, o) => s + o.quantity - o.filledQuantity, 0)
)

const pendingSellCount = computed(() =>
  stockOrders.value.filter((o) => o.type === 'sell' && (o.status === 'pending' || o.status === 'partial'))
    .reduce((s, o) => s + o.quantity - o.filledQuantity, 0)
)

const stockPosition = computed(() =>
  positionStore.positions.find((p) => p.stockCode === stockCode.value) ?? null
)

const availableBalance = computed(() =>
  authStore.balance
)

const orderPrice = ref(0)
const orderQuantity = ref(100)

let hasSetOrderPrice = false
watch(stockInfo, (info) => {
  if (info && !hasSetOrderPrice) {
    orderPrice.value = info.price
    hasSetOrderPrice = true
  }
}, { immediate: true })

function formatPrice(v: number): string {
  return v.toFixed(2)
}

function formatChange(v: number): string {
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(2)}`
}

function goBack() {
  router.push('/')
}

const tradeFeedback = ref('')
const orderSubmitting = ref(false)

async function handleBuy() {
  const p = orderPrice.value
  const q = orderQuantity.value
  if (p <= 0) {
    tradeFeedback.value = '请输入有效的委托价格'
    setTimeout(() => (tradeFeedback.value = ''), 2500)
    return
  }
  if (q <= 0) {
    tradeFeedback.value = '请输入有效的委托数量'
    setTimeout(() => (tradeFeedback.value = ''), 2500)
    return
  }
  if (q % 100 !== 0) {
    tradeFeedback.value = '买入数量必须为100的整数倍'
    setTimeout(() => (tradeFeedback.value = ''), 2500)
    return
  }
  const cost = p * q
  if (cost > authStore.balance) {
    tradeFeedback.value = '余额不足'
    setTimeout(() => (tradeFeedback.value = ''), 2500)
    return
  }

  orderSubmitting.value = true
  try {
    const result = await api.post('/api/orders', {
      stockCode: stockCode.value,
      type: 'buy',
      price: p,
      quantity: q,
    }) as unknown as { order: Order; trades: unknown[] }

    const statusText = result.order.status === 'filled' ? '已成交' : result.order.status === 'partial' ? '部分成交' : '已挂单'
    tradeFeedback.value = `买入${statusText}：${stockCode.value} ${q}股 @¥${p.toFixed(2)}`
    setTimeout(() => (tradeFeedback.value = ''), 3000)
  } catch (err: any) {
    tradeFeedback.value = err?.message || '下单失败'
    setTimeout(() => (tradeFeedback.value = ''), 3000)
  } finally {
    orderSubmitting.value = false
  }
}

async function handleSell() {
  const p = orderPrice.value
  const q = orderQuantity.value
  if (p <= 0) {
    tradeFeedback.value = '请输入有效的委托价格'
    setTimeout(() => (tradeFeedback.value = ''), 2500)
    return
  }
  if (q <= 0) {
    tradeFeedback.value = '请输入有效的委托数量'
    setTimeout(() => (tradeFeedback.value = ''), 2500)
    return
  }

  const pos = positionStore.positions.find((pos) => pos.stockCode === stockCode.value)
  if (!pos) {
    tradeFeedback.value = '您未持有该股票'
    setTimeout(() => (tradeFeedback.value = ''), 2500)
    return
  }
  if (q > pos.quantity) {
    tradeFeedback.value = '持仓不足'
    setTimeout(() => (tradeFeedback.value = ''), 2500)
    return
  }
  if (pos.quantity < 100 && q !== pos.quantity) {
    tradeFeedback.value = `持仓不足100股（${pos.quantity}股），必须全额卖出`
    setTimeout(() => (tradeFeedback.value = ''), 3000)
    return
  }

  orderSubmitting.value = true
  try {
    const result = await api.post('/api/orders', {
      stockCode: stockCode.value,
      type: 'sell',
      price: p,
      quantity: q,
    }) as unknown as { order: Order; trades: unknown[] }

    const statusText = result.order.status === 'filled' ? '已成交' : result.order.status === 'partial' ? '部分成交' : '已挂单'
    tradeFeedback.value = `卖出${statusText}：${stockCode.value} ${q}股 @¥${p.toFixed(2)}`
    setTimeout(() => (tradeFeedback.value = ''), 3000)
  } catch (err: any) {
    tradeFeedback.value = err?.message || '下单失败'
    setTimeout(() => (tradeFeedback.value = ''), 3000)
  } finally {
    orderSubmitting.value = false
  }
}
</script>

<template>
  <div class="stock-detail">
    <div class="detail-topbar">
      <button class="btn back-btn" @click="goBack">← 返回</button>

      <div v-if="stockInfo" class="stock-meta">
        <div class="meta-left">
          <h2>{{ stockInfo.name }}</h2>
          <span class="meta-code">{{ stockInfo.code }}</span>
        </div>
        <div class="meta-price">
          <span class="meta-price-val">{{ formatPrice(stockInfo.price) }}</span>
          <span :class="stockInfo.change >= 0 ? 'color-up' : 'color-down'" class="meta-change">
            {{ formatChange(stockInfo.change) }} ({{ formatChange(stockInfo.changePercent) }}%)
          </span>
        </div>
        <div class="meta-detail">
          <span class="meta-item">开 {{ formatPrice(stockInfo.open) }}</span>
          <span class="meta-item">高 {{ formatPrice(stockInfo.high) }}</span>
          <span class="meta-item">低 {{ formatPrice(stockInfo.low) }}</span>
          <span class="meta-item">昨收 {{ formatPrice(stockInfo.preClose) }}</span>
        </div>
        <div class="meta-orders">
          <span v-if="pendingBuyCount > 0" class="order-tag buy-tag">
            买挂 {{ pendingBuyCount }}股
          </span>
          <span v-if="pendingSellCount > 0" class="order-tag sell-tag">
            卖挂 {{ pendingSellCount }}股
          </span>
          <span v-if="pendingBuyCount === 0 && pendingSellCount === 0" class="order-tag none-tag">
            暂无挂单
          </span>
        </div>
      </div>
    </div>

    <div class="detail-body">
      <div class="chart-section card">
        <div class="card-header">
          <div class="mode-segment">
            <button
              :class="['seg-btn', { active: chartMode === 'realtime' }]"
              @click="setMode('realtime')"
            >实时</button>
            <button
              :class="['seg-btn', { active: chartMode === 'day' }]"
              @click="setMode('day')"
            >日K</button>
            <button
              :class="['seg-btn', { active: chartMode === 'week' }]"
              @click="setMode('week')"
            >周K</button>
            <button
              :class="['seg-btn', { active: chartMode === 'month' }]"
              @click="setMode('month')"
            >月K</button>
          </div>
          <div class="sim-clock">
            <span class="sim-date">{{ currentDate }}</span>
            <span class="sim-time">{{ currentTime }}</span>
          </div>
        </div>
        <div class="chart-wrap">
          <KLineChart
            :data="klineData"
            :tick-data="tickData"
            :mode="chartMode"
            height="100%"
          />
        </div>
      </div>

      <div class="depth-panel">
          <div v-if="stockInfo" class="depth-card card">
            <div class="card-header">
              <h3>五档盘口</h3>
            </div>
            <div class="depth-table-wrap">
              <table class="depth-table">
                <thead>
                  <tr>
                    <th class="depth-th-col">档位</th>
                    <th class="depth-th-price">价格</th>
                    <th class="depth-th-vol">数量</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(level, idx) in depthLevels.asks.slice().reverse()" :key="'ask-'+idx" class="depth-row depth-sell">
                    <td class="depth-col">卖{{ 5 - idx }}</td>
                    <td class="depth-price color-down mono">{{ level.price.toFixed(getDepthPrecision(stockInfo?.price ?? 0)) }}</td>
                    <td class="depth-vol mono">{{ level.volume }}</td>
                  </tr>
                  <tr class="depth-row depth-mid">
                    <td class="depth-col" colspan="3">
                      <span class="depth-mid-price mono">{{ (stockInfo?.price ?? 0).toFixed(getDepthPrecision(stockInfo?.price ?? 0)) }}</span>
                      <span :class="(stockInfo?.change ?? 0) >= 0 ? 'color-up' : 'color-down'" class="depth-mid-change mono">
                        {{ (stockInfo?.change ?? 0) >= 0 ? '▲' : '▼' }} {{ (stockInfo?.changePercent ?? 0).toFixed(2) }}%
                      </span>
                    </td>
                  </tr>
                  <tr v-for="(level, idx) in depthLevels.bids" :key="'bid-'+idx" class="depth-row depth-buy">
                    <td class="depth-col">买{{ idx + 1 }}</td>
                    <td class="depth-price color-up mono">{{ level.price.toFixed(getDepthPrecision(stockInfo?.price ?? 0)) }}</td>
                    <td class="depth-vol mono">{{ level.volume }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="trade-detail-card card">
            <div class="card-header">
              <h3>交易明细</h3>
              <span class="trade-count">共{{ simulatedTrades.length }}笔</span>
            </div>
            <div v-if="simulatedTrades.length === 0" class="empty-text-small">暂无成交记录</div>
            <div v-else class="trade-list-wrap">
              <div class="trade-list-header">
                <span class="trade-h-time">时间</span>
                <span class="trade-h-price">价格</span>
                <span class="trade-h-vol">数量</span>
                <span class="trade-h-type">方向</span>
              </div>
              <div
                v-for="t in simulatedTrades"
                :key="t.id"
                class="trade-row"
              >
                <span class="trade-time mono text-muted">{{ t.time }}</span>
                <span :class="['trade-price', 'mono', t.type === 'buy' ? 'color-up' : 'color-down']">
                  {{ t.price.toFixed(getDepthPrecision(stockInfo?.price ?? 0)) }}
                </span>
                <span class="trade-vol mono">{{ t.volume }}</span>
                <span :class="['trade-type', t.type === 'buy' ? 'color-up' : 'color-down']">
                  {{ t.type === 'buy' ? '买入' : '卖出' }}
                </span>
              </div>
            </div>
          </div>
      </div>

      <div class="side-section">
        <div v-if="stockDetail" class="detail-info-card card">
          <div class="card-header">
            <h3>盘口信息</h3>
          </div>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">最高</span>
              <span class="detail-val color-up">{{ stockDetail.high.toFixed(2) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">最低</span>
              <span class="detail-val color-down">{{ stockDetail.low.toFixed(2) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">今开</span>
              <span class="detail-val">{{ stockDetail.open.toFixed(2) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">昨收</span>
              <span class="detail-val">{{ stockDetail.preClose.toFixed(2) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">成交量</span>
              <span class="detail-val">{{ formatNum(stockDetail.volume, 0) }}股</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">成交额</span>
              <span class="detail-val">{{ formatNum(stockDetail.amount, 1) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">换手率</span>
              <span class="detail-val">{{ stockDetail.turnoverRate.toFixed(2) }}%</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">振幅</span>
              <span class="detail-val">{{ stockDetail.amplitude.toFixed(2) }}%</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">市盈(静)</span>
              <span class="detail-val">{{ stockDetail.peStatic.toFixed(2) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">市盈(TTM)</span>
              <span class="detail-val">{{ stockDetail.peTTM.toFixed(2) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">每股收益</span>
              <span class="detail-val">{{ stockDetail.eps.toFixed(3) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">每股净资产</span>
              <span class="detail-val">{{ stockDetail.navPerShare.toFixed(2) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">流通股本</span>
              <span class="detail-val">{{ formatNum(stockDetail.tradableShares, 1) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">总市值</span>
              <span class="detail-val">{{ formatNum(stockDetail.totalMarketCap, 1) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">流通市值</span>
              <span class="detail-val">{{ formatNum(stockDetail.tradableMarketCap, 1) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">市净率</span>
              <span class="detail-val">{{ stockDetail.pb.toFixed(2) }}</span>
            </div>
          </div>
        </div>

        <div class="position-card card">
          <div class="card-header">
            <h3>账户持仓</h3>
          </div>
          <div class="pos-info">
            <div class="pos-row">
              <span class="pos-label">可用余额</span>
              <span class="pos-val mono color-up">¥{{ availableBalance.toLocaleString() }}</span>
            </div>
            <div class="pos-row" v-if="stockPosition">
              <span class="pos-label">持有 {{ stockInfo?.name ?? stockCode }}</span>
              <span class="pos-val mono">{{ stockPosition.quantity }}股</span>
            </div>
            <div class="pos-row" v-if="stockPosition">
              <span class="pos-label">持仓成本</span>
              <span class="pos-val mono">¥{{ stockPosition.avgPrice.toFixed(2) }}</span>
            </div>
            <div class="pos-row" v-if="stockPosition && stockInfo">
              <span class="pos-label">持仓市值</span>
              <span class="pos-val mono">¥{{ (stockPosition.quantity * stockInfo.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
            </div>
            <div class="pos-row" v-if="stockPosition && stockInfo">
              <span class="pos-label">浮动盈亏</span>
              <span :class="['pos-val', 'mono', (stockInfo.price - stockPosition.avgPrice) >= 0 ? 'color-up' : 'color-down']">
                {{ (stockInfo.price - stockPosition.avgPrice >= 0 ? '+' : '') }}{{ ((stockInfo.price - stockPosition.avgPrice) * stockPosition.quantity).toFixed(2) }}
              </span>
            </div>
            <div v-if="!stockPosition" class="empty-text-small">暂未持有该股票</div>
          </div>
        </div>

        <div class="trade-card card">
          <div class="card-header">
            <h3>快速交易</h3>
          </div>
          <div class="form-group">
            <label>价格</label>
            <input v-model.number="orderPrice" type="number" step="0.01" />
          </div>
          <div class="form-group">
            <label>数量（股）</label>
            <input v-model.number="orderQuantity" type="number" step="100" min="100" />
          </div>
          <div class="btn-row">
            <button class="btn btn-up flex-1" :disabled="orderSubmitting" @click="handleBuy">买入</button>
            <button class="btn btn-down flex-1" :disabled="orderSubmitting" @click="handleSell">卖出</button>
          </div>
          <div v-if="tradeFeedback" class="trade-toast">{{ tradeFeedback }}</div>
        </div>

        <div class="orders-card card">
          <div class="card-header">
            <h3>挂单明细</h3>
          </div>
          <div v-if="stockOrders.length === 0" class="empty-text">该股票暂无挂单</div>
          <div v-else class="orders-split">
            <div class="orders-col">
              <div class="orders-col-header color-up">买入挂单</div>
              <div v-if="buyOrders.length === 0" class="empty-text-small">暂无</div>
              <div
                v-for="o in buyOrders"
                :key="o.id"
                class="order-row"
              >
                <span class="mono">{{ o.price.toFixed(2) }}</span>
                <span class="mono">{{ o.quantity }}股</span>
                <span class="mono text-muted">成交{{ o.filledQuantity }}</span>
                <span :class="o.status === 'filled' ? 'color-up' : o.status === 'cancelled' ? 'color-flat' : 'color-down'">
                  {{ o.status === 'pending' ? '待成交' : o.status === 'partial' ? '部分' : o.status === 'filled' ? '已成交' : '已撤' }}
                </span>
              </div>
            </div>
            <div class="orders-col">
              <div class="orders-col-header color-down">卖出挂单</div>
              <div v-if="sellOrders.length === 0" class="empty-text-small">暂无</div>
              <div
                v-for="o in sellOrders"
                :key="o.id"
                class="order-row"
              >
                <span class="mono">{{ o.price.toFixed(2) }}</span>
                <span class="mono">{{ o.quantity }}股</span>
                <span class="mono text-muted">成交{{ o.filledQuantity }}</span>
                <span :class="o.status === 'filled' ? 'color-up' : o.status === 'cancelled' ? 'color-flat' : 'color-down'">
                  {{ o.status === 'pending' ? '待成交' : o.status === 'partial' ? '部分' : o.status === 'filled' ? '已成交' : '已撤' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stock-detail {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 8px;
  gap: 8px;
}

.detail-topbar {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 8px 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  flex-shrink: 0;
}

.back-btn {
  flex-shrink: 0;
}

.stock-meta {
  display: flex;
  align-items: baseline;
  gap: 16px;
  flex: 1;
}

.meta-left {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.meta-left h2 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.meta-code {
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.meta-price-val {
  font-size: 18px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--text-primary);
}

.meta-change {
  font-size: 13px;
  font-family: var(--font-mono);
  margin-left: 4px;
}

.meta-detail {
  display: flex;
  gap: 16px;
  font-size: 11px;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  margin-left: auto;
}

.meta-item {
  white-space: nowrap;
}

.meta-orders {
  display: flex;
  gap: 8px;
  margin-left: 16px;
}

.order-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 3px;
  font-weight: 600;
}

.buy-tag {
  color: var(--color-up);
  border: 1px solid var(--color-up-bg);
}

.sell-tag {
  color: var(--color-down);
  border: 1px solid var(--color-down-bg);
}

.none-tag {
  color: var(--text-muted);
  border: 1px solid var(--border-accent);
}

.detail-body {
  flex: 1;
  display: flex;
  gap: 8px;
  min-height: 0;
  overflow: hidden;
}

.chart-section {
  flex: 3;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chart-wrap {
  flex: 1;
  min-height: 0;
}

.depth-panel {
  flex: none;
  width: 340px;
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 8px;
}

.depth-card {
  flex-shrink: 0;
}

.trade-detail-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.side-section {
  flex: 2;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
}

.trade-card {
  flex-shrink: 0;
}

.form-group {
  margin-bottom: 8px;
}

.form-group label {
  display: block;
  font-size: 10px;
  color: var(--text-secondary);
  margin-bottom: 3px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn-row {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.flex-1 { flex: 1; }

.trade-toast {
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--accent-glow);
  border: 1px solid var(--accent);
  border-radius: 4px;
  font-size: 11px;
  color: var(--accent-neon);
  font-family: var(--font-mono);
  animation: fadeInOut 3s ease;
}

@keyframes fadeInOut {
  0% { opacity: 0; transform: translateY(-4px); }
  10% { opacity: 1; transform: translateY(0); }
  80% { opacity: 1; }
  100% { opacity: 0; }
}

.btn-sm {
  padding: 3px 10px;
  font-size: 11px;
}

.mode-segment {
  display: flex;
  background: var(--bg-muted, #f0f3f6);
  border-radius: 6px;
  padding: 2px;
  gap: 0;
}

.seg-btn {
  padding: 4px 14px;
  border: none;
  border-radius: 5px;
  background: transparent;
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.seg-btn:hover {
  color: var(--text-primary);
}

.seg-btn.active {
  background: #fff;
  color: var(--accent, #2563eb);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

[data-theme='dark'] .mode-segment {
  background: rgba(255, 255, 255, 0.06);
}

[data-theme='dark'] .seg-btn.active {
  background: rgba(255, 255, 255, 0.12);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.sim-clock {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 11px;
}

.sim-date {
  color: var(--text-secondary);
}

.sim-time {
  color: var(--color-up);
  font-weight: 600;
  animation: pulse 1.5s ease-in-out infinite;
}

.orders-card {
  flex-shrink: 0;
}

.orders-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.order-row {
  display: flex;
  gap: 4px;
  padding: 3px 4px;
  font-size: 9px;
  border-bottom: 1px solid var(--border-primary);
  align-items: center;
  justify-content: space-between;
}

.order-row:last-child {
  border-bottom: none;
}

.mono {
  font-family: var(--font-mono);
}

.text-muted {
  color: var(--text-muted);
}

.empty-text {
  text-align: center;
  color: var(--text-muted);
  padding: 20px 0;
  font-size: 12px;
}

.empty-text-small {
  text-align: center;
  color: var(--text-muted);
  padding: 6px 0;
  font-size: 10px;
}

.detail-info-card {
  flex-shrink: 0;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 12px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 0;
  font-size: 10px;
  border-bottom: 1px solid var(--border-primary);
}

.detail-item:last-child,
.detail-item:nth-last-child(2):nth-child(odd) {
  border-bottom: none;
}

.detail-label {
  color: var(--text-muted);
  white-space: nowrap;
}

.detail-val {
  font-family: var(--font-mono);
  color: var(--text-primary);
  text-align: right;
}

.position-card {
  flex-shrink: 0;
}

.pos-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pos-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  font-size: 11px;
  border-bottom: 1px solid var(--border-primary);
}

.pos-row:last-child {
  border-bottom: none;
}

.pos-label {
  color: var(--text-secondary);
}

.pos-val {
  font-weight: 600;
}

.depth-table-wrap {
  overflow: hidden;
}

.depth-table {
  width: 100%;
  font-size: 11px;
}

.depth-table thead th {
  padding: 3px 4px;
  font-size: 9px;
  text-transform: none;
  letter-spacing: 0;
  border-bottom: 1px solid var(--border-accent);
}

.depth-th-col {
  text-align: left;
  width: 25%;
}

.depth-th-price {
  text-align: center;
  width: 37.5%;
}

.depth-th-vol {
  text-align: right;
  width: 37.5%;
}

.depth-row td {
  padding: 3px 4px;
  border-bottom: none;
}

.depth-col {
  text-align: left;
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 600;
}

.depth-price {
  text-align: center;
  font-size: 11px;
  font-weight: 600;
}

.depth-vol {
  text-align: right;
  font-size: 10px;
  color: var(--text-secondary);
}

.depth-mid td {
  padding: 6px 4px;
  text-align: center;
  background: var(--bg-hover);
  border-top: 1px solid var(--border-primary);
  border-bottom: 1px solid var(--border-primary);
}

.depth-mid-price {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.depth-mid-change {
  font-size: 11px;
  margin-left: 8px;
  font-weight: 600;
}

.trade-count {
  font-size: 10px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.trade-list-wrap {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.trade-list-header {
  display: flex;
  padding: 3px 4px;
  font-size: 9px;
  color: var(--text-muted);
  text-transform: uppercase;
  border-bottom: 1px solid var(--border-accent);
  position: sticky;
  top: 0;
  background: var(--bg-card);
  z-index: 1;
}

.trade-h-time { width: 25%; text-align: left; }
.trade-h-price { width: 25%; text-align: center; }
.trade-h-vol { width: 25%; text-align: center; }
.trade-h-type { width: 25%; text-align: right; }

.trade-row {
  display: flex;
  padding: 3px 4px;
  font-size: 10px;
  border-bottom: 1px solid var(--border-primary);
  align-items: center;
}

.trade-row:last-child {
  border-bottom: none;
}

.trade-row:hover {
  background: var(--bg-hover);
}

.trade-time { width: 25%; text-align: left; }
.trade-price { width: 25%; text-align: center; font-weight: 600; }
.trade-vol { width: 25%; text-align: center; }
.trade-type { width: 25%; text-align: right; font-weight: 600; }

.orders-split {
  display: flex;
  gap: 8px;
}

.orders-col {
  flex: 1;
  min-width: 0;
}

.orders-col-header {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 0 4px;
  border-bottom: 1px solid var(--border-accent);
  margin-bottom: 4px;
  text-align: center;
}
</style>
