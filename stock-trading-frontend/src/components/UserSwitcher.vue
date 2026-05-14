<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSessionStore, type StoredSession } from '@/stores/sessions'
import { marketWebSocket } from '@/services/websocket'
import { api } from '@/services/api'

const router = useRouter()
const authStore = useAuthStore()
const sessionStore = useSessionStore()

const showDropdown = ref(false)
const switchingUserId = ref<string | null>(null)

const otherSessions = computed(() =>
  sessionStore.sessions.value.filter((s) => s.userId !== authStore.userId)
)

function toggleDropdown() {
  showDropdown.value = !showDropdown.value
}

function closeDropdown() {
  showDropdown.value = false
}

async function handleSwitch(session: StoredSession) {
  if (session.userId === authStore.userId) {
    closeDropdown()
    return
  }

  switchingUserId.value = session.userId
  closeDropdown()

  marketWebSocket.disconnect()

  try {
    await authStore.switchUser(session)
    marketWebSocket.connect(session.userId)

    const userRes = (await api.get('/api/auth/user')) as unknown as { balance: number; frozenBalance: number }
    authStore.setUserData(userRes)
  } catch {
    marketWebSocket.connect(authStore.userId!)
  } finally {
    switchingUserId.value = null
  }
}

async function handleDelete(session: StoredSession, event: Event) {
  event.stopPropagation()
  await authStore.deleteSessionAndLogout(session.userId)

  if (authStore.userId) {
    return
  }

  const remaining = sessionStore.sessions.value
  if (remaining.length > 0) {
    await handleSwitch(remaining[0])
  } else {
    router.push('/login')
  }
}

function handleAddAccount() {
  closeDropdown()
  router.push('/login?add=1')
}

async function handleLogout() {
  closeDropdown()
  marketWebSocket.disconnect()
  const userId = authStore.userId
  await authStore.logout()
  if (userId) {
    sessionStore.remove(userId)
  }
  router.push('/login')
}
</script>

<template>
  <div class="user-switcher" v-click-outside="closeDropdown">
    <button class="switcher-trigger" @click="toggleDropdown">
      <span class="current-user">{{ authStore.user?.username ?? '未登录' }}</span>
      <span class="arrow">▾</span>
    </button>

    <div v-if="showDropdown" class="dropdown-menu">
      <div
        v-for="session in otherSessions"
        :key="session.userId"
        class="dropdown-item"
        :class="{ switching: switchingUserId === session.userId }"
        @click="handleSwitch(session)"
      >
        <span class="session-username">{{ session.username }}</span>
        <span v-if="switchingUserId === session.userId" class="switching-text">切换中...</span>
        <button
          class="btn-delete"
          title="删除此登录记录"
          @click="handleDelete(session, $event)"
        >
          ✕
        </button>
      </div>

      <div class="dropdown-footer">
        <button class="btn-add" @click="handleAddAccount">+ 添加账号</button>
        <button class="btn-logout" @click="handleLogout">退出当前账号</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.user-switcher {
  position: relative;
}

.switcher-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.switcher-trigger:hover {
  background: rgba(255, 255, 255, 0.2);
}

.current-user {
  font-weight: 500;
}

.arrow {
  font-size: 10px;
  transition: transform 0.2s;
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  min-width: 200px;
  z-index: 1000;
  overflow: hidden;
}

.dropdown-item {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  cursor: pointer;
  color: #333;
  font-size: 14px;
  transition: background 0.15s;
}

.dropdown-item:hover {
  background: #f5f5f5;
}

.dropdown-item.switching {
  opacity: 0.6;
  cursor: wait;
}

.session-username {
  flex: 1;
}

.switching-text {
  font-size: 11px;
  color: #999;
  margin-right: 6px;
}

.btn-delete {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 4px;
  line-height: 1;
  border-radius: 3px;
}

.btn-delete:hover {
  color: #ff4d4f;
  background: rgba(255, 77, 79, 0.1);
}

.dropdown-footer {
  display: flex;
  border-top: 1px solid #f0f0f0;
}

.btn-add,
.btn-logout {
  flex: 1;
  padding: 10px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  color: #666;
  transition: background 0.15s;
}

.btn-add:hover {
  background: #f0f0f0;
  color: #1890ff;
}

.btn-logout:hover {
  background: #f0f0f0;
  color: #ff4d4f;
}
</style>
