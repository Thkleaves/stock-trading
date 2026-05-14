<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { marketWebSocket } from '@/services/websocket'
import { api } from '@/services/api'
import MarketBoard from '@/components/MarketBoard.vue'
import PositionList from '@/components/PositionList.vue'
import TradePanel from '@/components/TradePanel.vue'
import OrderList from '@/components/OrderList.vue'
import TradeRecord from '@/components/TradeRecord.vue'
import UserSwitcher from '@/components/UserSwitcher.vue'

const router = useRouter()
const authStore = useAuthStore()

onMounted(async () => {
  if (!authStore.userId) {
    router.replace('/login')
    return
  }

  marketWebSocket.connect(authStore.userId)

  try {
    const userRes = (await api.get('/api/auth/user')) as unknown as { balance: number; frozenBalance: number }
    authStore.setUserData(userRes)
  } catch (e) {
    console.error('[Dashboard] 用户信息加载失败', e)
  }
})

onUnmounted(() => {
  marketWebSocket.disconnect()
})

function formatBalance(balance: number): string {
  return balance.toLocaleString('zh-CN')
}
</script>

<template>
  <div class="dashboard">
    <header class="dashboard-header">
      <h1>股票交易系统</h1>
      <div class="header-info">
        <span class="balance">
          可用：
          <strong>¥{{ formatBalance(authStore.user?.balance ?? 0) }}</strong>
        </span>
        <span v-if="(authStore.user?.frozenBalance ?? 0) > 0" class="frozen">
          冻结：
          <strong>¥{{ formatBalance(authStore.user?.frozenBalance ?? 0) }}</strong>
        </span>
        <UserSwitcher />
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

.balance strong {
  color: #52c41a;
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
