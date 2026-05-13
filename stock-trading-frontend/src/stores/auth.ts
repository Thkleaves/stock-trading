import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserInfo } from '@/types'
import { api } from '@/services/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserInfo | null>(null)
  const token = ref<string | null>(null)

  const isLoggedIn = computed(() => !!token.value)

  function initGuest() {
    if (!token.value) {
      user.value = {
        userId: 'guest',
        username: '游客模式',
        balance: 1_000_000,
      }
    }
  }

  function setAuth(userInfo: UserInfo, userId: string) {
    user.value = userInfo
    token.value = userId
    localStorage.setItem('userId', userId)
    localStorage.setItem('user', JSON.stringify(userInfo))
  }

  function restoreAuth() {
    const savedUserId = localStorage.getItem('userId')
    const savedUser = localStorage.getItem('user')
    if (savedUserId && savedUser) {
      token.value = savedUserId
      user.value = JSON.parse(savedUser)
    }
  }

  async function login(username: string, password: string) {
    const data = await api.post('/api/auth/login', { username, password }) as unknown as UserInfo
    setAuth(data, data.userId)
  }

  async function register(username: string, password: string) {
    const data = await api.post('/api/auth/register', { username, password }) as unknown as UserInfo
    setAuth(data, data.userId)
  }

  function updateBalance(balance: number) {
    if (user.value) {
      user.value = { ...user.value, balance }
    }
  }

  function logout() {
    user.value = null
    token.value = null
    localStorage.removeItem('userId')
    localStorage.removeItem('user')
  }

  return { user, token, isLoggedIn, initGuest, login, register, updateBalance, logout, restoreAuth }
})
