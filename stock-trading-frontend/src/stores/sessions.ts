import { ref, computed } from 'vue'

export interface StoredSession {
  userId: string
  username: string
  password: string
}

const SESSIONS_KEY = 'trading_sessions'
const ACTIVE_KEY = 'trading_active_user'

function readSessions(): StoredSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeSessions(list: StoredSession[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(list))
}

const sessions = ref<StoredSession[]>(readSessions())
const activeUserId = ref<string | null>(localStorage.getItem(ACTIVE_KEY) || null)

export function useSessionStore() {
  const activeSession = computed(() =>
    sessions.value.find((s) => s.userId === activeUserId.value) ?? null
  )

  function add(userId: string, username: string, password: string) {
    const existing = sessions.value.find((s) => s.userId === userId)
    if (existing) {
      existing.password = password
    } else {
      sessions.value.push({ userId, username, password })
    }
    writeSessions(sessions.value)
    setActive(userId)
  }

  function remove(userId: string) {
    sessions.value = sessions.value.filter((s) => s.userId !== userId)
    writeSessions(sessions.value)
    if (activeUserId.value === userId) {
      activeUserId.value = null
      localStorage.removeItem(ACTIVE_KEY)
    }
  }

  function setActive(userId: string) {
    activeUserId.value = userId
    localStorage.setItem(ACTIVE_KEY, userId)
  }

  function clearActive() {
    activeUserId.value = null
    localStorage.removeItem(ACTIVE_KEY)
  }

  function findByUsername(username: string): StoredSession | undefined {
    return sessions.value.find((s) => s.username === username)
  }

  function getByUserId(userId: string): StoredSession | undefined {
    return sessions.value.find((s) => s.userId === userId)
  }

  return {
    sessions,
    activeUserId,
    activeSession,
    add,
    remove,
    setActive,
    clearActive,
    findByUsername,
    getByUserId,
  }
}
