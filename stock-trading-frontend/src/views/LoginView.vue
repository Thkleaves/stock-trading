<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTheme } from '@/composables/useTheme'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const { isDark, toggle } = useTheme()

const isRegister = ref(route.query.add === '1')
const username = ref('')
const password = ref('')
const errorMsg = ref('')

const title = computed(() => isRegister.value ? '添加账号' : '交易系统登录')

function submit() {
  errorMsg.value = ''
  const u = username.value.trim()
  const p = password.value.trim()
  if (!u || !p) {
    errorMsg.value = '请输入用户名和密码'
    return
  }
  auth.guestLogin(u, p)
  router.push('/')
}
</script>

<template>
  <div class="login-page">
    <div class="login-card card">
      <div class="login-header">
        <h2>{{ title }}</h2>
        <div class="theme-toggle" @click="toggle">
          <span class="theme-label">{{ isDark ? '暗' : '亮' }}</span>
          <div :class="['toggle-track', { dark: isDark }]">
            <div class="toggle-thumb" />
          </div>
        </div>
      </div>

      <div class="login-form">
        <label class="field-label">用户名</label>
        <input
          v-model="username"
          type="text"
          placeholder="输入用户名"
          class="login-input"
          @keyup.enter="submit"
        />

        <label class="field-label">密码</label>
        <input
          v-model="password"
          type="password"
          placeholder="输入密码"
          class="login-input"
          @keyup.enter="submit"
        />

        <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>

        <button class="btn btn-primary login-btn" @click="submit">
          {{ isRegister ? '添加' : '登录' }}
        </button>

        <div class="toggle-mode">
          <span v-if="!isRegister">
            或
            <a href="#" @click.prevent="isRegister = true">添加新账号</a>
          </span>
          <span v-else>
            已有账号？
            <a href="#" @click.prevent="isRegister = false">返回登录</a>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
}

.login-card {
  width: 360px;
  padding: 28px 32px;
}

.login-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.login-header h2 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 11px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 4px;
}

.login-input {
  padding: 8px 10px;
  font-size: 13px;
}

.login-btn {
  margin-top: 12px;
  padding: 10px;
  font-size: 14px;
  width: 100%;
}

.error-msg {
  font-size: 11px;
  color: var(--color-up);
  padding: 4px 0;
}

.toggle-mode {
  text-align: center;
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 12px;
}

.toggle-mode a {
  color: var(--accent-neon);
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
</style>
