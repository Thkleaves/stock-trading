<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSessionStore, type StoredSession } from '@/stores/sessions'

const router = useRouter()
const authStore = useAuthStore()
const sessionStore = useSessionStore()

const showDropdown = ref(false)
const root = ref<HTMLElement | null>(null)

function onDocClick(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) {
    showDropdown.value = false
  }
}

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))

const otherSessions = computed(() =>
  sessionStore.sessions.value.filter((s) => s.userId !== authStore.userId)
)

function toggleDropdown() {
  showDropdown.value = !showDropdown.value
}

function closeDropdown() {
  showDropdown.value = false
}

function handleSwitch(session: StoredSession) {
  if (session.userId === authStore.userId) {
    closeDropdown()
    return
  }
  closeDropdown()
  authStore.guestSwitchUser(session)
}

function handleDelete(session: StoredSession, event: Event) {
  event.stopPropagation()
  authStore.deleteSessionAndLogout(session.userId)

  if (authStore.userId) {
    return
  }

  const remaining = sessionStore.sessions.value
  if (remaining.length > 0) {
    handleSwitch(remaining[0])
  } else {
    router.push('/login')
  }
}

function handleAddAccount() {
  closeDropdown()
  router.push('/login?add=1')
}

function handleLogout() {
  closeDropdown()
  const uid = authStore.userId
  authStore.guestLogout()
  if (uid) {
    sessionStore.remove(uid)
  }
  router.push('/login')
}
</script>

<template>
  <div ref="root" class="user-switcher">
    <button class="switcher-trigger" @click="toggleDropdown">
      <span class="current-user">{{ authStore.user?.username ?? '未登录' }}</span>
      <span class="arrow">▾</span>
    </button>

    <div v-if="showDropdown" class="dropdown-menu">
      <div
        v-for="session in otherSessions"
        :key="session.userId"
        class="dropdown-item"
        @click="handleSwitch(session)"
      >
        <span class="session-username">{{ session.username }}</span>
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
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--border-accent);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-family: var(--font-sans);
}

.switcher-trigger:hover {
  background: var(--bg-hover);
}

.current-user {
  font-weight: 500;
}

.arrow {
  font-size: 10px;
  color: var(--text-muted);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
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
  color: var(--text-primary);
  font-size: 13px;
  transition: background 0.15s;
}

.dropdown-item:hover {
  background: var(--bg-hover);
}

.session-username {
  flex: 1;
}

.btn-delete {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
  padding: 2px 4px;
  line-height: 1;
  border-radius: 3px;
}

.btn-delete:hover {
  color: var(--color-up);
  background: var(--color-up-bg);
}

.dropdown-footer {
  display: flex;
  border-top: 1px solid var(--border-primary);
}

.btn-add,
.btn-logout {
  flex: 1;
  padding: 10px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary);
  transition: background 0.15s;
}

.btn-add:hover {
  background: var(--bg-hover);
  color: var(--accent-neon);
}

.btn-logout:hover {
  background: var(--bg-hover);
  color: var(--color-up);
}
</style>
