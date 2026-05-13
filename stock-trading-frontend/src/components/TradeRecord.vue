<script setup lang="ts">
import { useTradeStore } from '@/stores/trade'

const tradeStore = useTradeStore()

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN')
}

function directionLabel(type: 'buy' | 'sell'): string {
  return type === 'buy' ? '买入' : '卖出'
}
</script>

<template>
  <div class="trade-record card">
    <h3>成交记录</h3>
    <div class="table-wrap">
      <table v-if="tradeStore.recentTrades.length > 0">
        <thead>
          <tr>
            <th>股票</th>
            <th>方向</th>
            <th>价格</th>
            <th>数量</th>
            <th>时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in tradeStore.recentTrades" :key="t.id">
            <td>{{ t.stockCode }}</td>
            <td :class="t.type === 'buy' ? 'buy' : 'sell'">{{ directionLabel(t.type) }}</td>
            <td>¥{{ t.price.toFixed(2) }}</td>
            <td>{{ t.quantity }}</td>
            <td>{{ formatTime(t.time) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-tip">暂无成交记录</div>
    </div>
  </div>
</template>

<style scoped>
.trade-record h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #1a1a1a;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 8px;
}

.table-wrap {
  max-height: 280px;
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

.buy {
  color: #cf1322;
}

.sell {
  color: #389e0d;
}

.empty-tip {
  text-align: center;
  color: #aaa;
  padding: 24px 0;
  font-size: 13px;
}
</style>
