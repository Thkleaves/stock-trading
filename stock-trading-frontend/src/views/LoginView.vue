<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSessionStore } from '@/stores/sessions'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const sessionStore = useSessionStore()

const isRegister = ref(route.query.add === '1')
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const errorMsg = ref('')
const submitting = ref(false)

const title = computed(() => isRegister.value ? '注册账号' : '交易系统登录')

async function submit() {
  errorMsg.value = ''
  const u = username.value.trim()
  const p = password.value.trim()
  if (!u || !p) {
    errorMsg.value = '请输入用户名和密码'
    return
  }

  if (isRegister.value && p !== confirmPassword.value.trim()) {
    errorMsg.value = '两次输入的密码不一致'
    return
  }

  submitting.value = true
  const result = isRegister.value
    ? await auth.reg({ username: u, password: p })
    : await auth.login({ username: u, password: p })
  submitting.value = false

  if (!result.ok) {
    errorMsg.value = result.message || '操作失败'
    return
  }

  sessionStore.add(auth.userId, auth.username, p)
  router.push('/')
}
</script>

<template>
  <div class="login-page">
    <div class="login-card card">
      <div class="login-header">
        <h2>{{ title }}</h2>
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

        <label v-if="isRegister" class="field-label">确认密码</label>
        <input
          v-if="isRegister"
          v-model="confirmPassword"
          type="password"
          placeholder="再次输入密码"
          class="login-input"
          @keyup.enter="submit"
        />

        <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>

        <button class="btn btn-primary login-btn" :disabled="submitting" @click="submit">
          <span v-if="submitting">处理中...</span>
          <span v-else>{{ isRegister ? '注册' : '登录' }}</span>
        </button>

        <div class="toggle-mode">
          <span v-if="!isRegister">
            或
            <a href="#" @click.prevent="isRegister = true">注册新账号</a>
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
</style>
