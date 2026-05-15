<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSimulation } from '@/composables/useSimulation'
import type { ChartMode } from '@/types'
import KLineChart from '@/components/KLineChart.vue'

const router = useRouter()
const {
  currentTime,
  currentDate,
  isLoaded,
  stockRefs,
  currentPrices,
  indexTicks,
  dailyKLines,
  weeklyKLines,
  monthlyKLines,
} = useSimulation()

const indexMode = ref<ChartMode>('realtime')

const indexData = computed(() => {
  if (indexMode.value === 'day') return dailyKLines.value['000001'] || []
  if (indexMode.value === 'week') return weeklyKLines.value['000001'] || []
  if (indexMode.value === 'month') return monthlyKLines.value['000001'] || []
  return dailyKLines.value['000001'] || []
})

function setIndexMode(mode: ChartMode) {
  indexMode.value = mode
}

const indexInfo = computed(() => {
  const ref = stockRefs.value['000001']
  if (!ref) return null
  const price = currentPrices['000001'] ?? ref.preClose
  const change = price - ref.preClose
  const changePercent = ref.preClose > 0 ? (change / ref.preClose) * 100 : 0
  return {
    code: ref.code,
    name: ref.name,
    price,
    change: +change.toFixed(2),
    changePercent: +changePercent.toFixed(2),
  }
})

const stockList = computed(() => {
  return Object.entries(stockRefs.value)
    .filter(([, ref]) => ref.type === 'stock')
    .map(([code, ref]) => {
      const price = currentPrices[code] ?? ref.open
      const change = price - ref.open
      const changePercent = ref.open > 0 ? (change / ref.open) * 100 : 0
      return {
        code,
        name: ref.name,
        price,
        change: +change.toFixed(2),
        changePercent: +changePercent.toFixed(2),
        high: ref.high,
        low: ref.low,
        open: ref.open,
        preClose: ref.preClose,
      }
    })
})

function goStockDetail(code: string) {
  router.push(`/stock/${code}`)
}


</script>

<template>
  <div class="home">
    <div class="home-top">
      <div class="index-section card">
        <div class="index-header">
          <div class="index-info" v-if="indexInfo">
            <span class="index-name">{{ indexInfo.name }}</span>
            <span :class="['index-price', indexInfo.change >= 0 ? 'up' : 'down']">
              {{ indexInfo.price.toFixed(2) }}
            </span>
            <span :class="['index-change', indexInfo.change >= 0 ? 'up' : 'down']">
              {{ indexInfo.change >= 0 ? '+' : '' }}{{ indexInfo.change.toFixed(2) }}
              ({{ indexInfo.change >= 0 ? '+' : '' }}{{ indexInfo.changePercent.toFixed(2) }}%)
            </span>
          </div>
        </div>
        <div class="index-chart-wrap">
          <div class="index-period-bar">
            <div class="period-btns">
              <button
                :class="['btn btn-xs', { active: indexMode === 'realtime' }]"
                @click="setIndexMode('realtime')"
              >实时</button>
              <button
                :class="['btn btn-xs', { active: indexMode === 'day' }]"
                @click="setIndexMode('day')"
              >日K</button>
              <button
                :class="['btn btn-xs', { active: indexMode === 'week' }]"
                @click="setIndexMode('week')"
              >周K</button>
              <button
                :class="['btn btn-xs', { active: indexMode === 'month' }]"
                @click="setIndexMode('month')"
              >月K</button>
            </div>
            <div class="sim-clock">
              <span class="sim-date">{{ currentDate }}</span>
              <span class="sim-time">{{ currentTime }}</span>
            </div>
          </div>
          <div class="index-chart-inner">
            <KLineChart
              :data="indexData"
              :tick-data="indexMode === 'realtime' ? (indexTicks['000001'] || []) : []"
              :mode="indexMode"
              height="100%"
            />
          </div>
        </div>
      </div>

      <div class="stock-list-section card">
        <div class="card-header">
          <h3>股票列表</h3>
          <span class="loading-hint" v-if="!isLoaded">加载中...</span>
        </div>
        <div class="stock-table-wrap">
          <table class="stock-table">
            <thead>
              <tr>
                <th>代码</th>
                <th>名称</th>
                <th>最新价</th>
                <th>涨跌</th>
                <th>涨跌幅</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="stock in stockList"
                :key="stock.code"
                class="stock-row"
                @dblclick="goStockDetail(stock.code)"
              >
                <td class="code">{{ stock.code }}</td>
                <td class="name">{{ stock.name }}</td>
                <td :class="stock.change >= 0 ? 'up' : 'down'">{{ stock.price.toFixed(2) }}</td>
                <td :class="stock.change >= 0 ? 'up' : 'down'">
                  {{ stock.change >= 0 ? '+' : '' }}{{ stock.change.toFixed(2) }}
                </td>
                <td :class="stock.change >= 0 ? 'up' : 'down'">
                  {{ stock.change >= 0 ? '+' : '' }}{{ stock.changePercent.toFixed(2) }}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.home-top {
  flex: 1;
  display: flex;
  gap: 12px;
  min-height: 0;
  padding: 8px;
}

.index-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.index-header {
  padding: 8px 12px 4px;
  flex-shrink: 0;
}

.index-info {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.index-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.index-price {
  font-size: 20px;
  font-weight: 700;
  font-family: var(--font-mono);
}

.index-change {
  font-size: 12px;
  font-family: var(--font-mono);
}

.index-chart-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.index-period-bar {
  display: flex;
  align-items: center;
  padding: 4px 12px;
  gap: 8px;
  flex-shrink: 0;
}

.period-btns {
  display: flex;
  gap: 2px;
}

.btn-xs {
  padding: 2px 8px;
  font-size: 10px;
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border-radius: 3px;
  cursor: pointer;
}

.btn-xs.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.index-chart-inner {
  flex: 1;
  min-height: 0;
}

.stock-list-section {
  width: 360px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex-shrink: 0;
}

.card-header {
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.card-header h3 {
  margin: 0;
  font-size: 13px;
  color: var(--text-primary);
}

.loading-hint {
  font-size: 11px;
  color: var(--text-secondary);
}

.stock-table-wrap {
  flex: 1;
  overflow-y: auto;
}

.stock-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.stock-table th {
  position: sticky;
  top: 0;
  background: var(--bg-primary);
  padding: 6px 8px;
  text-align: left;
  color: var(--text-secondary);
  font-weight: 500;
  border-bottom: 1px solid var(--border);
  z-index: 1;
}

.stock-table td {
  padding: 5px 8px;
  border-bottom: 1px solid var(--border);
  font-family: var(--font-mono);
}

.stock-row {
  cursor: pointer;
  transition: background 0.1s;
}

.stock-row:hover {
  background: var(--hover);
}

.stock-row .name {
  font-family: -apple-system, sans-serif;
}

.code {
  color: var(--text-secondary);
}

.up {
  color: var(--color-up);
}

.down {
  color: var(--color-down);
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
</style>
