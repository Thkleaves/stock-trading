<script setup lang="ts">
import { useMarketStore } from '@/stores/market'
import { computed } from 'vue'

const marketStore = useMarketStore()

const quoteList = computed(() => Object.values(marketStore.quotes))

function formatPrice(price: number): string {
  return price.toFixed(2)
}

function formatChange(change: number): string {
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(2)}`
}

function formatChangePercent(pct: number): string {
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

function priceColor(change: number): string {
  if (change > 0) return '#cf1322'
  if (change < 0) return '#389e0d'
  return '#666'
}
</script>

<template>
  <div class="market-board card">
    <h3>行情看板</h3>
    <div v-if="quoteList.length === 0" class="empty-tip">等待行情数据...</div>
    <div v-else class="quote-list">
      <div
        v-for="quote in quoteList"
        :key="quote.code"
        class="quote-item"
      >
        <div class="quote-info">
          <span class="stock-code">{{ quote.code }}</span>
          <span class="stock-name">{{ quote.name }}</span>
        </div>
        <div class="quote-price" :style="{ color: priceColor(quote.change) }">
          <span class="price-val">¥{{ formatPrice(quote.price) }}</span>
          <span class="price-change">
            {{ formatChange(quote.change) }} {{ formatChangePercent(quote.changePercent) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.market-board {
  min-height: 200px;
}

h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #1a1a1a;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 8px;
}

.quote-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quote-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: #fafafa;
  border-radius: 6px;
  border: 1px solid #f0f0f0;
  transition: background 0.2s;
}

.quote-item:hover {
  background: #e6f7ff;
}

.quote-info {
  display: flex;
  gap: 8px;
  align-items: center;
}

.stock-code {
  font-weight: 600;
  font-size: 14px;
  color: #333;
}

.stock-name {
  font-size: 13px;
  color: #888;
}

.quote-price {
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 14px;
}

.price-val {
  font-weight: 600;
}

.price-change {
  font-size: 12px;
}

.empty-tip {
  text-align: center;
  color: #aaa;
  padding: 40px 0;
  font-size: 14px;
}
</style>
