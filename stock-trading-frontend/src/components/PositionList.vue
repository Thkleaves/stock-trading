<script setup lang="ts">
import { usePositionStore } from '@/stores/position'
import { useMarketStore } from '@/stores/market'
import { computed } from 'vue'

const positionStore = usePositionStore()
const marketStore = useMarketStore()

const positionWithPnl = computed(() =>
  positionStore.positions.map((p) => {
    const quote = marketStore.getQuote(p.stockCode)
    const marketPrice = quote?.price ?? p.currentPrice
    const pnl = (marketPrice - p.avgPrice) * p.quantity
    const pnlPercent = p.avgPrice > 0 ? ((marketPrice - p.avgPrice) / p.avgPrice) * 100 : 0
    return { ...p, marketPrice, pnl, pnlPercent }
  })
)

function pnlColor(val: number): string {
  if (val > 0) return '#cf1322'
  if (val < 0) return '#389e0d'
  return '#666'
}

function formatPnl(val: number): string {
  const sign = val >= 0 ? '+' : ''
  return `${sign}${val.toFixed(2)}`
}
</script>

<template>
  <div class="position-list card">
    <h3>持仓列表</h3>
    <div class="table-wrap">
      <table v-if="positionWithPnl.length > 0">
        <thead>
          <tr>
            <th>股票</th>
            <th>持仓数量</th>
            <th>均价</th>
            <th>现价</th>
            <th>盈亏</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in positionWithPnl" :key="p.stockCode">
            <td>{{ p.stockCode }}<span class="stock-name-sub">{{ p.stockName }}</span></td>
            <td>{{ p.quantity }}</td>
            <td>¥{{ p.avgPrice.toFixed(2) }}</td>
            <td>¥{{ p.marketPrice.toFixed(2) }}</td>
            <td :style="{ color: pnlColor(p.pnl) }">
              ¥{{ formatPnl(p.pnl) }} ({{ formatPnl(p.pnlPercent) }}%)
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-tip">暂无持仓</div>
    </div>
  </div>
</template>

<style scoped>
.position-list h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #1a1a1a;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 8px;
}

.table-wrap {
  max-height: 300px;
  overflow-y: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

th,
td {
  padding: 8px 6px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}

th {
  background: #fafafa;
  color: #555;
  font-weight: 500;
}

.stock-name-sub {
  color: #999;
  font-size: 12px;
  margin-left: 6px;
}

.empty-tip {
  text-align: center;
  color: #aaa;
  padding: 24px 0;
  font-size: 13px;
}
</style>
