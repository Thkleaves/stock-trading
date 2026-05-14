<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MOCK_STOCK_LIST, MOCK_USER_ORDERS, getStockKLines } from '@/data/mock'
import type { StockInfo, KLineData, UserOrder } from '@/data/mock'
import KLineChart from '@/components/KLineChart.vue'

const route = useRoute()
const router = useRouter()

const stockCode = computed(() => route.params.code as string)
const stockInfo = ref<StockInfo | undefined>(MOCK_STOCK_LIST.find((s) => s.code === stockCode.value))
const klineData = ref<KLineData[]>(getStockKLines(stockCode.value))

const stockOrders = computed<UserOrder[]>(() =>
  MOCK_USER_ORDERS.filter((o) => o.stockCode === stockCode.value)
)

const pendingBuyCount = computed(() =>
  stockOrders.value.filter((o) => o.type === 'buy' && (o.status === 'pending' || o.status === 'partial'))
    .reduce((s, o) => s + o.quantity - o.filledQuantity, 0)
)

const pendingSellCount = computed(() =>
  stockOrders.value.filter((o) => o.type === 'sell' && (o.status === 'pending' || o.status === 'partial'))
    .reduce((s, o) => s + o.quantity - o.filledQuantity, 0)
)

const orderPrice = ref(0)
const orderQuantity = ref(0)

onMounted(() => {
  if (stockInfo.value) {
    orderPrice.value = stockInfo.value.price
    orderQuantity.value = 100
  }
})

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
            买挂 {{ pendingBuyCount }}手
          </span>
          <span v-if="pendingSellCount > 0" class="order-tag sell-tag">
            卖挂 {{ pendingSellCount }}手
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
          <h3>K线图</h3>
          <div class="period-selector">
            <button class="btn btn-sm active">日K</button>
          </div>
        </div>
        <div class="chart-wrap">
          <KLineChart :data="klineData" :symbol="stockCode" height="100%" />
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
            <label>数量（手）</label>
            <input v-model.number="orderQuantity" type="number" step="100" min="100" />
          </div>
          <div class="btn-row">
            <button class="btn btn-up flex-1">买入</button>
            <button class="btn btn-down flex-1">卖出</button>
          </div>
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
              <span class="mono">{{ o.quantity }}手</span>
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

.btn-sm {
  padding: 3px 10px;
  font-size: 11px;
}

.period-selector .active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
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
