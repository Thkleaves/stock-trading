<script setup lang="ts">
import { ref, computed, watch } from 'vue'
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

const pendingBuyCount = computed(() =>
  stockOrders.value.filter((o) => o.type === 'buy' && (o.status === 'pending' || o.status === 'partial'))
    .reduce((s, o) => s + o.quantity - o.filledQuantity, 0)
)

const pendingSellCount = computed(() =>
  stockOrders.value.filter((o) => o.type === 'sell' && (o.status === 'pending' || o.status === 'partial'))
    .reduce((s, o) => s + o.quantity - o.filledQuantity, 0)
)

function stockNameByCode(code: string): string {
  return stockRefs.value[code]?.name ?? code
}

function formatOrderTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function orderStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: '待成交',
    partial: '部分成交',
    filled: '已成交',
    cancelled: '已撤',
  }
  return map[status] ?? status
}

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

      <div class="side-section">
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
          <div v-else class="orders-list">
            <div
              v-for="o in stockOrders"
              :key="o.id"
              class="order-row"
            >
              <span :class="o.type === 'buy' ? 'color-up' : 'color-down'">
                {{ o.type === 'buy' ? '买' : '卖' }}
              </span>
              <span class="mono">{{ o.price.toFixed(2) }}</span>
              <span class="mono">{{ o.quantity }}股</span>
              <span class="mono text-muted">已成交{{ o.filledQuantity }}</span>
              <span :class="o.status === 'filled' ? 'color-up' : o.status === 'cancelled' ? 'color-flat' : 'color-down'">
                {{ o.status === 'pending' ? '待成交' : o.status === 'partial' ? '部分' : o.status === 'filled' ? '已成交' : '已撤' }}
              </span>
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
  background: var(--color-up-bg);
  color: var(--color-up);
  border: 1px solid var(--color-up-bg);
}

.sell-tag {
  background: var(--color-down-bg);
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

.side-section {
  flex: 1;
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
  gap: 12px;
  padding: 6px 8px;
  font-size: 11px;
  border-bottom: 1px solid var(--border-primary);
  align-items: center;
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
</style>
