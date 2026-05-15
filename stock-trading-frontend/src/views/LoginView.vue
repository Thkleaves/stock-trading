<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
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

/* ========== Canvas 金融特效 ========== */
const canvasRef = ref<HTMLCanvasElement | null>(null)
let rafId = 0

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  color: string
}

interface FloatingText {
  x: number
  y: number
  text: string
  alpha: number
  speed: number
  color: string
}

interface Candle {
  x: number
  open: number
  close: number
  high: number
  low: number
  width: number
  alpha: number
}

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  let W = 0
  let H = 0
  const cvs = canvas
  const c = ctx

  const particles: Particle[] = []
  const texts: FloatingText[] = []
  const candles: Candle[] = []
  const lines: number[][] = []

  const colors = {
    up: '#00e676',
    down: '#ff5252',
    grid: 'rgba(64, 128, 255, 0.08)',
    accent: '#448aff',
    cyan: '#00bcd4',
    purple: '#7c4dff',
  }

  function resize() {
    const rect = cvs.parentElement!.getBoundingClientRect()
    W = rect.width
    H = rect.height
    const dpr = window.devicePixelRatio || 1
    cvs.width = W * dpr
    cvs.height = H * dpr
    cvs.style.width = W + 'px'
    cvs.style.height = H + 'px'
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function initLines() {
    lines.length = 0
    const count = 5
    for (let i = 0; i < count; i++) {
      const pts: number[] = []
      let y = H * 0.3 + Math.random() * H * 0.4
      for (let x = 0; x <= W; x += 8) {
        y += (Math.random() - 0.5) * 4
        y = Math.max(H * 0.15, Math.min(H * 0.85, y))
        pts.push(y)
      }
      lines.push(pts)
    }
  }

  function initParticles() {
    particles.length = 0
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.6 + 0.2,
        color: Math.random() > 0.5 ? colors.up : colors.accent,
      })
    }
  }

  function spawnText() {
    if (texts.length > 15) return
    const price = (Math.random() * 500 + 10).toFixed(2)
    const change = (Math.random() * 10 - 5).toFixed(2)
    const sign = Number(change) >= 0 ? '+' : ''
    texts.push({
      x: Math.random() * W,
      y: H + 20,
      text: `${price} ${sign}${change}%`,
      alpha: 1,
      speed: 0.4 + Math.random() * 0.6,
      color: Number(change) >= 0 ? colors.up : colors.down,
    })
  }

  function spawnCandle() {
    while (candles.length > 0 && candles[0].x + candles[0].width / 2 < -10) {
      candles.shift()
    }
    const h = H * 0.25
    const base = H * 0.55
    const open = base + (Math.random() - 0.5) * h
    const close = open + (Math.random() - 0.5) * h * 0.6
    const high = Math.max(open, close) + Math.random() * h * 0.3
    const low = Math.min(open, close) - Math.random() * h * 0.3
    candles.push({
      x: W + 10,
      open,
      close,
      high,
      low,
      width: 4 + Math.random() * 4,
      alpha: 1,
    })
  }

  function drawBg() {
    const grad = c.createLinearGradient(0, 0, W, H)
    grad.addColorStop(0, '#060b14')
    grad.addColorStop(0.5, '#0a1224')
    grad.addColorStop(1, '#070d1a')
    c.fillStyle = grad
    c.fillRect(0, 0, W, H)
  }

  function drawGrid() {
    c.strokeStyle = colors.grid
    c.lineWidth = 1
    const step = 40
    const offset = (Date.now() / 50) % step
    for (let x = offset; x < W; x += step) {
      c.beginPath()
      c.moveTo(x, 0)
      c.lineTo(x, H)
      c.stroke()
    }
    for (let y = offset; y < H; y += step) {
      c.beginPath()
      c.moveTo(0, y)
      c.lineTo(W, y)
      c.stroke()
    }
  }

  function drawLines() {
    const lineColors = [colors.accent, colors.cyan, colors.purple, 'rgba(0,230,118,0.6)', 'rgba(255,82,82,0.5)']
    lines.forEach((pts, idx) => {
      // shift points left slightly
      if (Math.random() > 0.7) {
        for (let i = 0; i < pts.length; i++) {
          pts[i] += (Math.random() - 0.5) * 1.5
          pts[i] = Math.max(H * 0.1, Math.min(H * 0.9, pts[i]))
        }
      }
      c.beginPath()
      c.strokeStyle = lineColors[idx % lineColors.length]
      c.lineWidth = 1.5
      for (let i = 0; i < pts.length; i++) {
        const x = i * 8
        if (i === 0) c.moveTo(x, pts[i])
        else c.lineTo(x, pts[i])
      }
      c.stroke()

      // glow under line
      c.beginPath()
      c.strokeStyle = lineColors[idx % lineColors.length]
      c.lineWidth = 8
      c.globalAlpha = 0.06
      for (let i = 0; i < pts.length; i++) {
        const x = i * 8
        if (i === 0) c.moveTo(x, pts[i])
        else c.lineTo(x, pts[i])
      }
      c.stroke()
      c.globalAlpha = 1
    })
  }

  function drawCandles() {
    for (let i = candles.length - 1; i >= 0; i--) {
      const candle = candles[i]
      candle.x -= 0.6
      if (candle.x < -10) {
        candles.splice(i, 1)
        continue
      }
      const isUp = candle.close < candle.open
      c.fillStyle = isUp ? colors.up : colors.down
      c.globalAlpha = 0.85
      // body
      const top = Math.min(candle.open, candle.close)
      const height = Math.abs(candle.close - candle.open) || 1
      c.fillRect(candle.x - candle.width / 2, top, candle.width, height)
      // wick
      c.fillRect(candle.x - 0.5, candle.high, 1, candle.low - candle.high)
      c.globalAlpha = 1
    }
  }

  function drawParticles() {
    particles.forEach(p => {
      p.x += p.vx
      p.y += p.vy
      if (p.x < 0) p.x = W
      if (p.x > W) p.x = 0
      if (p.y < 0) p.y = H
      if (p.y > H) p.y = 0
      c.beginPath()
      c.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      c.fillStyle = p.color
      c.globalAlpha = p.alpha
      c.fill()
    })
    c.globalAlpha = 1
  }

  function drawTexts() {
    c.font = '11px monospace'
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i]
      t.y -= t.speed
      t.alpha -= 0.003
      if (t.alpha <= 0) {
        texts.splice(i, 1)
        continue
      }
      c.fillStyle = t.color
      c.globalAlpha = t.alpha
      c.fillText(t.text, t.x, t.y)
    }
    c.globalAlpha = 1
  }

  function drawScanLine() {
    const y = ((Date.now() / 20) % (H + 100)) - 50
    const grad = c.createLinearGradient(0, y - 40, 0, y + 40)
    grad.addColorStop(0, 'rgba(68,138,255,0)')
    grad.addColorStop(0.5, 'rgba(68,138,255,0.08)')
    grad.addColorStop(1, 'rgba(68,138,255,0)')
    c.fillStyle = grad
    c.fillRect(0, y - 40, W, 80)
  }

  function drawOverlay() {
    // vignette
    const rad = Math.max(W, H) * 0.7
    const grad = c.createRadialGradient(W / 2, H / 2, rad * 0.4, W / 2, H / 2, rad)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, 'rgba(0,0,0,0.55)')
    c.fillStyle = grad
    c.fillRect(0, 0, W, H)
  }

  function drawTitle() {
    c.font = 'bold 28px sans-serif'
    c.fillStyle = 'rgba(255,255,255,0.9)'
    c.fillText('STOCK SIMULATION', 40, 60)
    c.font = '12px monospace'
    c.fillStyle = 'rgba(255,255,255,0.4)'
    c.fillText('REAL-TIME TRADING SYSTEM v2.0', 40, 82)

    // status dots
    const dotY = 95
    c.beginPath()
    c.arc(42, dotY, 3, 0, Math.PI * 2)
    c.fillStyle = colors.up
    c.fill()
    c.font = '11px monospace'
    c.fillStyle = 'rgba(255,255,255,0.35)'
    c.fillText('MARKET OPEN', 52, dotY + 3)
  }

  function loop() {
    drawBg()
    drawGrid()
    drawLines()
    drawCandles()
    drawParticles()
    drawTexts()
    drawScanLine()
    drawOverlay()
    drawTitle()

    if (Math.random() > 0.92) spawnText()
    if (Math.random() > 0.96) spawnCandle()

    rafId = requestAnimationFrame(loop)
  }

  resize()
  initLines()
  initParticles()
  loop()

  window.addEventListener('resize', () => {
    resize()
    initLines()
  })
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
})
</script>

<template>
  <div class="login-page">
    <!-- 左侧 Canvas 特效区域 -->
    <div class="login-visual">
      <canvas ref="canvasRef" class="visual-canvas" />
    </div>

    <!-- 右侧登录表单 -->
    <div class="login-panel">
      <div class="login-card">
        <div class="login-header">
          <div class="brand">
            <div class="brand-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
                <polyline points="16 7 22 7 22 13"></polyline>
              </svg>
            </div>
            <div class="brand-text">
              <h1>TradeSim Pro</h1>
              <p>模拟股票交易系统</p>
            </div>
          </div>
          <h2 class="form-title">{{ title }}</h2>
        </div>

        <div class="login-form">
          <div class="input-group">
            <label class="field-label">用户名</label>
            <div class="input-wrap">
              <span class="input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              </span>
              <input
                v-model="username"
                type="text"
                placeholder="请输入用户名"
                class="login-input"
                @keyup.enter="submit"
              />
            </div>
          </div>

          <div class="input-group">
            <label class="field-label">密码</label>
            <div class="input-wrap">
              <span class="input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              </span>
              <input
                v-model="password"
                type="password"
                placeholder="请输入密码"
                class="login-input"
                @keyup.enter="submit"
              />
            </div>
          </div>

          <div v-if="isRegister" class="input-group">
            <label class="field-label">确认密码</label>
            <div class="input-wrap">
              <span class="input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              </span>
              <input
                v-model="confirmPassword"
                type="password"
                placeholder="再次输入密码"
                class="login-input"
                @keyup.enter="submit"
              />
            </div>
          </div>

          <div v-if="errorMsg" class="error-msg">
            <span class="error-dot"></span>
            {{ errorMsg }}
          </div>

          <button class="login-btn" :disabled="submitting" @click="submit">
            <span v-if="submitting" class="btn-spinner"></span>
            <span v-else>{{ isRegister ? '注册账号' : '安全登录' }}</span>
          </button>

          <div class="toggle-mode">
            <span v-if="!isRegister">
              还没有账号？
              <a href="#" @click.prevent="isRegister = true">立即注册</a>
            </span>
            <span v-else>
              已有账号？
              <a href="#" @click.prevent="isRegister = false">返回登录</a>
            </span>
          </div>
        </div>
      </div>

      <div class="panel-footer">
        <p>© 2025 TradeSim Pro · 模拟交易 风险可控</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  width: 100%;
  height: 100%;
  background: var(--bg-primary);
  overflow: hidden;
}

/* 左侧视觉区域 */
.login-visual {
  flex: 1;
  position: relative;
  min-width: 0;
  background: #060b14;
  overflow: hidden;
}

.visual-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

/* 右侧登录面板 */
.login-panel {
  width: 420px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: var(--bg-primary);
  border-left: 1px solid var(--border-primary);
  padding: 40px;
  position: relative;
}

.login-card {
  width: 100%;
  max-width: 340px;
}

.login-header {
  margin-bottom: 32px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.brand-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--accent), var(--accent-neon));
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 4px 16px rgba(68, 138, 255, 0.25);
}

.brand-text h1 {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
  margin: 0;
}

.brand-text p {
  font-size: 12px;
  color: var(--text-muted);
  margin: 2px 0 0;
}

.form-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

/* 表单 */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  letter-spacing: 0.3px;
}

.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 12px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.login-input {
  width: 100%;
  padding: 10px 12px 10px 38px;
  font-size: 14px;
  color: var(--text-primary);
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  outline: none;
  transition: all 0.2s ease;
}

.login-input::placeholder {
  color: var(--text-muted);
}

.login-input:hover {
  border-color: var(--border-accent);
}

.login-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

/* 错误提示 */
.error-msg {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--color-down);
  background: rgba(255, 82, 82, 0.08);
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid rgba(255, 82, 82, 0.15);
}

.error-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-down);
  flex-shrink: 0;
}

/* 登录按钮 */
.login-btn {
  width: 100%;
  padding: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--accent-neon));
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 4px 14px rgba(68, 138, 255, 0.3);
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(68, 138, 255, 0.4);
}

.login-btn:active:not(:disabled) {
  transform: translateY(0);
}

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 切换模式 */
.toggle-mode {
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}

.toggle-mode a {
  color: var(--accent-neon);
  text-decoration: none;
  font-weight: 500;
  transition: opacity 0.15s;
}

.toggle-mode a:hover {
  opacity: 0.8;
  text-decoration: underline;
}

/* 底部 */
.panel-footer {
  position: absolute;
  bottom: 24px;
  left: 0;
  right: 0;
  text-align: center;
}

.panel-footer p {
  font-size: 11px;
  color: var(--text-muted);
  opacity: 0.6;
  margin: 0;
}

/* 响应式 */
@media (max-width: 860px) {
  .login-visual {
    display: none;
  }
  .login-panel {
    width: 100%;
    border-left: none;
  }
}
</style>
