<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'
import { useSimulation } from '@/composables/useSimulation'
import UserSwitcher from '@/components/UserSwitcher.vue'

const router = useRouter()
const route = useRoute()
const { isDark, toggle } = useTheme()
const { currentDate, currentTime } = useSimulation()

const navItems = [
  { path: '/', label: '行情' },
  { path: '/profile', label: '资产' },
]

const activePath = computed(() => route.path)
</script>

<template>
  <div class="app-layout">
    <nav class="top-nav">
      <div class="nav-brand">
        <span class="brand-logo">TRADE</span>
        <span class="brand-divider">|</span>
        <span class="brand-sub">PRO</span>
      </div>
      <div class="nav-links">
        <button
          v-for="item in navItems"
          :key="item.path"
          :class="['nav-btn', { active: activePath === item.path }]"
          @click="router.push(item.path)"
        >
          {{ item.label }}
        </button>
      </div>
      <div class="nav-right">
        <UserSwitcher />
        <span class="nav-time">{{ currentDate }} {{ currentTime }}</span>
        <div class="theme-toggle" @click="toggle">
          <span class="theme-label">{{ isDark ? '暗' : '亮' }}</span>
          <div :class="['toggle-track', { dark: isDark }]">
            <div class="toggle-thumb" />
          </div>
        </div>
      </div>
    </nav>
    <main class="main-content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.top-nav {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-primary);
  flex-shrink: 0;
  gap: 24px;
}

.nav-brand {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--text-primary);
}

.brand-logo {
  color: var(--accent-neon);
}

.brand-divider {
  color: var(--border-accent);
  margin: 0 4px;
}

.brand-sub {
  color: var(--text-secondary);
  font-weight: 400;
}

.nav-links {
  display: flex;
  gap: 4px;
}

.nav-btn {
  padding: 6px 14px;
  border: none;
  background: none;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
}

.nav-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.nav-btn.active {
  color: var(--accent-neon);
  background: var(--accent-glow);
}

.nav-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 16px;
}

.nav-time {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
}

.theme-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}

.theme-label {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  transition: color 0.2s;
}

.toggle-track {
  width: 32px;
  height: 16px;
  border-radius: 8px;
  background: var(--border-accent);
  position: relative;
  transition: background 0.25s;
}

.toggle-track.dark {
  background: var(--accent);
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.toggle-track.dark .toggle-thumb {
  transform: translateX(16px);
}

.main-content {
  flex: 1;
  overflow: hidden;
}
</style>
