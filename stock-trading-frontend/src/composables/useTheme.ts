import { ref, watch } from 'vue'

const THEME_KEY = 'trading-system-theme'

const stored = localStorage.getItem(THEME_KEY)
const isDark = ref<boolean>(stored ? stored === 'dark' : true)

function applyTheme(dark: boolean) {
  if (dark) {
    document.documentElement.setAttribute('data-theme', 'dark')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
  localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light')
}

applyTheme(isDark.value)

watch(isDark, (val) => applyTheme(val))

export function useTheme() {
  function toggle() {
    isDark.value = !isDark.value
  }

  return { isDark, toggle }
}
