<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useMarketStore } from '@/stores/market'
import { useOrderStore } from '@/stores/order'
import { usePositionStore } from '@/stores/position'
import { useTradeStore } from '@/stores/trade'
import { marketWebSocket } from '@/services/websocket'
import { api } from '@/services/api'
import MarketBoard from '@/components/MarketBoard.vue'
import TradePanel from '@/components/TradePanel.vue'
import OrderList from '@/components/OrderList.vue'
import PositionList from '@/components/PositionList.vue'
import TradeRecord from '@/components/TradeRecord.vue'

const router = useRouter()
const authStore = useAuthStore()
const marketStore = useMarketStore()
const orderStore = useOrderStore()
const positionStore = usePositionStore()
const tradeStore = useTradeStore()

onMounted(async () => {
  if (!authStore.token) {
    authStore.initGuest()
    marketStore.loadMockData()
    return
  }

  marketWebSocket.connect(authStore.token)

  try {
    const [orderRes, positionRes, tradeRes] = await Promise.all([
      api.get(`/api/orders?userId=${authStore.token}`),
      api.get(`/api/positions?userId=${authStore.token}`),
      api.get(`/api/trades?userId=${authStore.token}`),
    ])

    const orderData = orderRes as unknown as { orders: [] }
    const positionData = positionRes as unknown as { positions: [] }
    const tradeData = tradeRes as unknown as { trades: [] }

    orderStore.setOrders(orderData.orders || [])
    positionStore.setPositions(positionData.positions || [])
    tradeStore.setTrades(tradeData.trades || [])
  } catch (e) {
    console.error('[Dashboard] 初始化数据加载失败', e)
  }
})

onUnmounted(() => {
  marketWebSocket.disconnect()
})

function handleLogout() {
  marketWebSocket.disconnect()
  authStore.logout()
  router.push('/login')
}

function formatBalance(balance: number): string {
  return balance.toLocaleString('zh-CN')
}
</script>

<template>
  <div class="dashboard">
    <header class="dashboard-header">
      <h1>股票交易系统</h1>
      <div class="header-info">
        <span class="username">{{ authStore.user?.username ?? '游客' }}</span>
        <span class="balance">
          资金余额：
          <strong>¥{{ formatBalance(authStore.user?.balance ?? 0) }}</strong>
        </span>
        <button class="btn-logout" @click="handleLogout">退出登录</button>
      </div>
    </header>

    <div class="dashboard-body">
      <div class="left-column">
        <MarketBoard />
        <PositionList />
      </div>
      <div class="right-column">
        <TradePanel />
        <OrderList />
        <TradeRecord />
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  min-height: 100vh;
  background: #f0f2f5;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  height: 56px;
  background: #001529;
  color: #fff;
}

.dashboard-header h1 {
  font-size: 18px;
  margin: 0;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 20px;
  font-size: 14px;
}

.username {
  color: #fff;
}

.balance strong {
  color: #52c41a;
}

.btn-logout {
  padding: 4px 16px;
  background: transparent;
  color: #fff;
  border: 1px solid #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.btn-logout:hover {
  background: rgba(255, 255, 255, 0.1);
}

.dashboard-body {
  display: flex;
  gap: 16px;
  padding: 16px;
  max-width: 1400px;
  margin: 0 auto;
}

.left-column {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.right-column {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
