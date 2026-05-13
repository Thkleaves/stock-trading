<script setup lang="ts">
import { ref } from 'vue'
import { useOrderStore } from '@/stores/order'
import type { Order } from '@/types'

const orderStore = useOrderStore()
const activeTab = ref<'pending' | 'completed'>('pending')

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN')
}

function statusLabel(status: Order['status']): string {
  const map: Record<string, string> = {
    pending: '待成交',
    partial: '部分成交',
    filled: '已成交',
    cancelled: '已撤单',
  }
  return map[status] || status
}

function directionLabel(type: 'buy' | 'sell'): string {
  return type === 'buy' ? '买入' : '卖出'
}
</script>

<template>
  <div class="order-list card">
    <h3>委托列表</h3>
    <div class="tabs">
      <button
        :class="['tab', { active: activeTab === 'pending' }]"
        @click="activeTab = 'pending'"
      >
        未成交（{{ orderStore.pendingOrders.length }}）
      </button>
      <button
        :class="['tab', { active: activeTab === 'completed' }]"
        @click="activeTab = 'completed'"
      >
        已成交（{{ orderStore.completedOrders.length }}）
      </button>
    </div>

    <div v-if="activeTab === 'pending'" class="order-table-wrap">
      <table v-if="orderStore.pendingOrders.length > 0">
        <thead>
          <tr>
            <th>股票</th>
            <th>方向</th>
            <th>价格</th>
            <th>数量</th>
            <th>已成交</th>
            <th>状态</th>
            <th>时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="o in orderStore.pendingOrders" :key="o.id">
            <td>{{ o.stockCode }}</td>
            <td :class="o.type === 'buy' ? 'buy' : 'sell'">{{ directionLabel(o.type) }}</td>
            <td>¥{{ o.price.toFixed(2) }}</td>
            <td>{{ o.quantity }}</td>
            <td>{{ o.filledQuantity }}</td>
            <td>{{ statusLabel(o.status) }}</td>
            <td>{{ formatTime(o.createdAt) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-tip">暂无未成交委托</div>
    </div>

    <div v-if="activeTab === 'completed'" class="order-table-wrap">
      <table v-if="orderStore.completedOrders.length > 0">
        <thead>
          <tr>
            <th>股票</th>
            <th>方向</th>
            <th>价格</th>
            <th>数量</th>
            <th>状态</th>
            <th>时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="o in orderStore.completedOrders" :key="o.id">
            <td>{{ o.stockCode }}</td>
            <td :class="o.type === 'buy' ? 'buy' : 'sell'">{{ directionLabel(o.type) }}</td>
            <td>¥{{ o.price.toFixed(2) }}</td>
            <td>{{ o.quantity }}</td>
            <td>{{ statusLabel(o.status) }}</td>
            <td>{{ formatTime(o.createdAt) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-tip">暂无已成交委托</div>
    </div>
  </div>
</template>

<style scoped>
.order-list h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #1a1a1a;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 8px;
}

.tabs {
  display: flex;
  gap: 0;
  margin-bottom: 12px;
  border-bottom: 1px solid #e8e8e8;
}

.tab {
  padding: 6px 16px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  color: #666;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab.active {
  color: #1890ff;
  border-bottom-color: #1890ff;
}

.order-table-wrap {
  max-height: 320px;
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
  white-space: nowrap;
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
