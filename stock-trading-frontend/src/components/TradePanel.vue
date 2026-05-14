<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useMarketStore } from '@/stores/market'
import { useOrderStore } from '@/stores/order'
import { useTradeStore } from '@/stores/trade'
import { api } from '@/services/api'
import type { Order, Trade, UserInfo } from '@/types'

const authStore = useAuthStore()
const marketStore = useMarketStore()
const orderStore = useOrderStore()
const tradeStore = useTradeStore()

const stockCode = ref('')
const price = ref(0)
const quantity = ref(0)
const submitting = ref(false)
const message = ref('')
const isError = ref(false)

const quoteList = computed(() =>
  Object.values(marketStore.quotes).map((q) => ({
    label: `${q.code} ${q.name}`,
    value: q.code,
  }))
)

function onStockSelect(code: string) {
  stockCode.value = code
  const quote = marketStore.getQuote(code)
  if (quote) {
    price.value = quote.price
  }
}

async function submitOrder(type: 'buy' | 'sell') {
  message.value = ''
  if (!stockCode.value || price.value <= 0 || quantity.value <= 0) {
    message.value = '请完整填写下单信息'
    isError.value = true
    return
  }
  if (!authStore.userId) return

  submitting.value = true
  try {
    const res = await api.post('/api/orders', {
      stockCode: stockCode.value,
      type,
      price: price.value,
      quantity: quantity.value,
    }) as unknown as { order: Order; trades: Trade[] }

    orderStore.upsertOrder(res.order)

    if (res.trades.length > 0) {
      res.trades.forEach((t) => tradeStore.addTrade(t))
    }

    const userInfo = await (api.get('/api/auth/user') as Promise<UserInfo>)
    authStore.setUserData(userInfo)

    message.value = `${type === 'buy' ? '买入' : '卖出'}委托已提交`
    isError.value = false
  } catch (e: unknown) {
    message.value = e instanceof Error ? e.message : '下单失败'
    isError.value = true
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="trade-panel card">
    <h3>交易面板</h3>
    <div class="form-group">
      <label>股票</label>
      <select v-model="stockCode" @change="onStockSelect(($event.target as HTMLSelectElement).value)">
        <option value="">-- 请选择股票 --</option>
        <option v-for="q in quoteList" :key="q.value" :value="q.value">
          {{ q.label }}
        </option>
      </select>
    </div>
    <div class="form-group">
      <label>价格</label>
      <input v-model.number="price" type="number" step="0.01" min="0" placeholder="委托价格" />
    </div>
    <div class="form-group">
      <label>数量（手）</label>
      <input v-model.number="quantity" type="number" step="100" min="100" placeholder="委托数量" />
    </div>
    <p v-if="message" :class="['trade-msg', isError ? 'error' : 'success']">{{ message }}</p>
    <div class="btn-group">
      <button class="btn-buy" :disabled="submitting" @click="submitOrder('buy')">
        {{ submitting ? '提交中...' : '买入' }}
      </button>
      <button class="btn-sell" :disabled="submitting" @click="submitOrder('sell')">
        {{ submitting ? '提交中...' : '卖出' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.trade-panel h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #1a1a1a;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 8px;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
  color: #555;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

.trade-msg {
  font-size: 13px;
  margin: 4px 0;
}

.trade-msg.success {
  color: #52c41a;
}

.trade-msg.error {
  color: #ff4d4f;
}

.btn-group {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.btn-buy,
.btn-sell {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 4px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  color: #fff;
}

.btn-buy {
  background: #cf1322;
}

.btn-buy:hover {
  background: #ff4d4f;
}

.btn-sell {
  background: #389e0d;
}

.btn-sell:hover {
  background: #52c41a;
}

.btn-buy:disabled,
.btn-sell:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
