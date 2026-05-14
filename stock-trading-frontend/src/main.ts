import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/main.css'
import { vClickOutside } from './directives/clickOutside'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.directive('click-outside', vClickOutside)

const { useAuthStore } = await import('@/stores/auth')
const authStore = useAuthStore()
authStore.restoreAuth()

app.mount('#app')
