import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserInfo } from '@/types'
import { api } from '@/services/api'
import { useSessionStore, type StoredSession } from '@/stores/sessions'

export const useAuthStore = defineStore('auth', () => {
  const sessionStore = useSessionStore()
  const user = ref<UserInfo | null>(null)
  const userId = ref<string | null>(null)

  const isLoggedIn = computed(() => !!userId.value)

  function setUserData(data: { balance: number; frozenBalance: number }) {
    if (user.value) {
      user.value = { ...user.value, balance: data.balance, frozenBalance: data.frozenBalance }
    }
  }

  function setAuth(userInfo: UserInfo, id: string) {
    user.value = userInfo
    userId.value = id
  }

  function restoreAuth() {
    const activeId = sessionStore.activeUserId.value
    if (!activeId) return
    const cachedUser = localStorage.getItem('user')
    if (cachedUser) {
      const parsed = JSON.parse(cachedUser)
      if (parsed.userId === activeId) {
        userId.value = activeId
        user.value = parsed
        return
      }
    }
  }

  async function login(username: string, password: string) {
    const data = await api.post('/api/auth/login', { username, password }) as unknown as UserInfo
    setAuth(data, data.userId)
    sessionStore.add(data.userId, username, password)
    localStorage.setItem('user', JSON.stringify(data))
  }

  async function register(username: string, password: string) {
    const data = await api.post('/api/auth/register', { username, password }) as unknown as UserInfo
    setAuth(data, data.userId)
    sessionStore.add(data.userId, username, password)
    localStorage.setItem('user', JSON.stringify(data))
  }

  async function switchUser(session: StoredSession) {
    const data = await api.post('/api/auth/login', {
      username: session.username,
      password: session.password,
    }) as unknown as UserInfo
    setAuth(data, data.userId)
    localStorage.setItem('user', JSON.stringify(data))
    sessionStore.setActive(data.userId)
    return data.userId
  }

  function clearCurrentUser() {
    user.value = null
    userId.value = null
    localStorage.removeItem('user')
  }

  async function logout() {
    try {
      await api.post('/api/auth/logout')
    } catch {
      // 即使后端登出失败，也清理本地状态
    }
    clearCurrentUser()
    sessionStore.clearActive()
  }

  async function deleteSessionAndLogout(userIdToRemove: string) {
    if (userIdToRemove === userId.value) {
      try {
        await api.post('/api/auth/logout')
      } catch {
        // 静默处理
      }
      clearCurrentUser()
    }
    sessionStore.remove(userIdToRemove)
  }

  return {
    user,
    userId,
    isLoggedIn,
    login,
    register,
    setUserData,
    switchUser,
    logout,
    deleteSessionAndLogout,
    clearCurrentUser,
    restoreAuth,
    sessionStore,
  }
})
