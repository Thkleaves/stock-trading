import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/services/api'
import { marketWebSocket } from '@/services/websocket'
import { usePositionStore } from '@/stores/position'
import { useOrderStore } from '@/stores/order'
import { useTradeStore } from '@/stores/trade'
import { usePnlCurveStore } from '@/stores/pnlCurve'
import type { LoginResponse } from '@/types'

export interface LoginParams {
  username: string
  password: string
}

export interface UserData {
  userId: string
  username: string
  balance: number
  frozenBalance?: number
}

export const useAuthStore = defineStore('auth', () => {
  const userId = ref('')
  const username = ref('')
  const balance = ref(0)
  const frozenBalance = ref(0)
  const initLoading = ref(true)

  const isLoggedIn = computed(() => !!userId.value)

  function populateStores(data: LoginResponse) {
    usePositionStore().setPositions(data.positions ?? [])
    useOrderStore().setOrders(data.orders ?? [])
    useTradeStore().setTrades(data.trades ?? [])
    usePnlCurveStore().setData(data.pnlCurve ?? [])
  }

  async function login(params: LoginParams): Promise<{ ok: boolean; message?: string }> {
    try {
      const data = await api.post('/api/auth/login', params) as unknown as LoginResponse
      if (data?.user?.userId) {
        applyUserData(data.user)
        populateStores(data)
        marketWebSocket.connect(data.user.userId)
        return { ok: true }
      }
      return { ok: false, message: '登录失败' }
    } catch (err: any) {
      return { ok: false, message: err?.message || '登录请求异常' }
    }
  }

  async function reg(params: LoginParams): Promise<{ ok: boolean; message?: string }> {
    try {
      const data = await api.post('/api/auth/register', params) as unknown as LoginResponse
      if (data?.user?.userId) {
        applyUserData(data.user)
        populateStores(data)
        marketWebSocket.connect(data.user.userId)
        return { ok: true }
      }
      return { ok: false, message: '注册失败' }
    } catch (err: any) {
      return { ok: false, message: err?.message || '注册请求异常' }
    }
  }

  async function restoreSession(): Promise<boolean> {
    initLoading.value = true
    try {
      const data = await api.get('/api/auth/user') as unknown as UserData
      if (data && data.userId) {
        applyUserData(data)
        try {
          const [positionsRes, pnlCurveRes] = await Promise.all([
            api.get('/api/positions') as unknown as { positions: import('@/types').Position[] },
            api.get('/api/auth/pnl-curve') as unknown as import('@/types').PnlCurveEntry[],
          ])
          if (positionsRes?.positions) {
            usePositionStore().setPositions(positionsRes.positions)
          }
          if (Array.isArray(pnlCurveRes)) {
            usePnlCurveStore().setData(pnlCurveRes)
          }
        } catch {
          // positions/pnlCurve 获取失败不影响主流程，WebSocket sync 会兜底
        }
        marketWebSocket.connect(data.userId)
        initLoading.value = false
        return true
      }
    } catch {
      // cookie 过期或不存在
    }
    initLoading.value = false
    return false
  }

  async function logout() {
    marketWebSocket.disconnect()
    try {
      await api.post('/api/auth/logout')
    } catch {
      // 即使后端通知失败也清除本地状态
    }
    userId.value = ''
    username.value = ''
    balance.value = 0
    frozenBalance.value = 0
    usePositionStore().setPositions([])
    useOrderStore().setOrders([])
    useTradeStore().setTrades([])
    usePnlCurveStore().clear()
  }

  function applyUserData(data: UserData) {
    userId.value = data.userId
    username.value = data.username
    balance.value = data.balance
    frozenBalance.value = data.frozenBalance ?? 0
  }

  function setUserData(data: { userId?: string; username?: string; balance: number; frozenBalance: number }) {
    if (data.userId !== undefined) userId.value = data.userId
    if (data.username !== undefined) username.value = data.username
    balance.value = data.balance
    frozenBalance.value = data.frozenBalance ?? 0
  }

  return { userId, username, balance, frozenBalance, isLoggedIn, initLoading, login, reg, restoreSession, logout, setUserData }
})
