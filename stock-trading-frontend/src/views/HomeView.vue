<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { MOCK_STOCK_LIST, MOCK_STOCKS } from '@/data/mock'
import type { StockInfo, KLineData } from '@/data/mock'
import KLineChart from '@/components/KLineChart.vue'

const router = useRouter()
const stockList = ref<StockInfo[]>(MOCK_STOCK_LIST.filter((s) => s.code !== '000001'))
const indexData = ref<KLineData[]>(MOCK_STOCKS['000001'] || [])
const indexInfo = computed(() => MOCK_STOCK_LIST.find((s) => s.code === '000001'))

const upCount = computed(() => stockList.value.filter((s) => s.change > 0).length)
const downCount = computed(() => stockList.value.filter((s) => s.change < 0).length)
const flatCount = computed(() => stockList.value.filter((s) => s.change === 0).length)

function formatPrice(v: number): string {
  return v.toFixed(2)
}

function formatChange(v: number): string {
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(2)}`
}

function formatVolume(v: number): string {
  if (v >= 1e8) return (v / 1e8).toFixed(1) + '亿'
  if (v >= 1e4) return (v / 1e4).toFixed(1) + '万'
  return v.toString()
}

function onStockDblClick(stock: StockInfo) {
  router.push(`/stock/${stock.code}`)
}

setInterval(() => {
  stockList.value = stockList.value.map((s) => {
    const delta = (Math.random() - 0.48) * 0.02 * s.price
    const newPrice = +(s.price + delta).toFixed(2)
    const newChange = +(s.change + delta).toFixed(2)
    const newChangePercent = +((newChange / s.preClose) * 100).toFixed(2)
    return { ...s, price: newPrice, change: newChange, changePercent: newChangePercent }
  })
}, 2000)
</script>

<template>
  <div class="home-view">
    <div class="index-panel card">
      <div v-if="indexInfo" class="index-header">
        <div class="index-info">
          <h2>{{ indexInfo.name }}</h2>
          <span class="index-code">{{ indexInfo.code }}</span>
        </div>
        <div class="index-price">
          <span class="price-val">{{ formatPrice(indexInfo.price) }}</span>
          <span :class="['price-change', indexInfo.change >= 0 ? 'color-up' : 'color-down']">
            {{ formatChange(indexInfo.change) }}
            ({{ formatChange(indexInfo.changePercent) }}%)
          </span>
        </div>
        <div class="index-meta">
          <span>开 {{ formatPrice(indexInfo.open) }}</span>
          <span>高 {{ formatPrice(indexInfo.high) }}</span>
          <span>低 {{ formatPrice(indexInfo.low) }}</span>
        </div>
      </div>
      <div class="index-chart-wrap">
        <KLineChart :data="indexData" height="100%" />
      </div>
    </div>

    <div class="stock-panel card">
      <div class="market-stats">
        <div class="stat-item">
          <span class="stat-label">上涨</span>
          <span class="stat-val color-up">{{ upCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">平盘</span>
          <span class="stat-val color-flat">{{ flatCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">下跌</span>
          <span class="stat-val color-down">{{ downCount }}</span>
        </div>
      </div>

      <div class="stock-table-wrap">
        <table>
          <thead>
            <tr>
              <th>名称</th>
              <th>最新价</th>
              <th>涨跌幅</th>
              <th>成交量</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="stock in stockList"
              :key="stock.code"
              class="stock-row"
              @dblclick="onStockDblClick(stock)"
              :title="'双击查看' + stock.name + '详情'"
            >
              <td>
                <span class="stock-name">{{ stock.name }}</span>
                <span class="stock-code-sub">{{ stock.code }}</span>
              </td>
              <td class="mono">{{ formatPrice(stock.price) }}</td>
              <td :class="stock.change >= 0 ? 'color-up' : 'color-down'">
                {{ formatChange(stock.changePercent) }}%
              </td>
              <td class="mono text-muted">{{ formatVolume(stock.volume) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-view {
  display: flex;
  height: 100%;
  padding: 8px;
  gap: 8px;
  overflow: hidden;
}

.index-panel {
  flex: 3;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.index-header {
  display: flex;
  align-items: baseline;
  gap: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-primary);
  flex-shrink: 0;
}

.index-info {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.index-info h2 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.index-code {
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.index-price {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.price-val {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  font-family: var(--font-mono);
}

.price-change {
  font-size: 12px;
  font-family: var(--font-mono);
}

.index-meta {
  margin-left: auto;
  display: flex;
  gap: 16px;
  font-size: 11px;
  color: var(--text-secondary);
  font-family: var(--font-mono);
}

.index-chart-wrap {
  flex: 1;
  min-height: 0;
}

.stock-panel {
  flex: 2;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.market-stats {
  display: flex;
  gap: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-primary);
  flex-shrink: 0;
}

.stat-item {
  display: flex;
  gap: 4px;
  font-size: 11px;
}

.stat-label {
  color: var(--text-secondary);
}

.stat-val {
  font-weight: 600;
  font-family: var(--font-mono);
}

.stock-table-wrap {
  flex: 1;
  overflow-y: auto;
  margin-top: 4px;
}

.stock-row {
  cursor: pointer;
  transition: background 0.1s;
}

.stock-row:hover {
  background: var(--bg-hover) !important;
  outline: 1px solid var(--border-accent);
  outline-offset: -1px;
}

.stock-name {
  font-weight: 500;
  color: var(--text-primary);
}

.stock-code-sub {
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
