import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserInfo } from '@/types'
import { useSessionStore, type StoredSession } from '@/stores/sessions'

function genUserId() {
  return 'u-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}

function createUserInfo(id: string, name: string): UserInfo {
  return {
    userId: id,
    username: name,
    balance: 1_000_000,
    frozenBalance: 0,
  }
}

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
      const parsed = JSON.parse(cachedUser) as UserInfo
      if (parsed.userId === activeId) {
        userId.value = activeId
        user.value = parsed
        return
      }
    }
  }

  function guestLogin(username: string, password: string) {
    const existing = sessionStore.findByUsername(username)
    let id: string
    if (existing) {
      id = existing.userId
    } else {
      id = genUserId()
    }
    const info = createUserInfo(id, username)
    setAuth(info, id)
    sessionStore.add(id, username, password)
    localStorage.setItem('user', JSON.stringify(info))
  }

  function guestSwitchUser(session: StoredSession) {
    const info = createUserInfo(session.userId, session.username)
    setAuth(info, session.userId)
    localStorage.setItem('user', JSON.stringify(info))
    sessionStore.setActive(session.userId)
  }

  function clearCurrentUser() {
    user.value = null
    userId.value = null
    localStorage.removeItem('user')
  }

  function guestLogout() {
    clearCurrentUser()
    sessionStore.clearActive()
  }

  function deleteSessionAndLogout(userIdToRemove: string) {
    if (userIdToRemove === userId.value) {
      clearCurrentUser()
    }
    sessionStore.remove(userIdToRemove)
  }

  return {
    user,
    userId,
    isLoggedIn,
    guestLogin,
    setUserData,
    guestSwitchUser,
    guestLogout,
    deleteSessionAndLogout,
    clearCurrentUser,
    restoreAuth,
    sessionStore,
  }
})
