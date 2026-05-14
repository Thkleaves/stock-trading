import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useSessionStore } from '@/stores/sessions'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/RegisterView.vue'),
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const sessionStore = useSessionStore()
  const isLoggedIn = !!sessionStore.activeUserId.value

  if (to.path === '/dashboard' && !isLoggedIn) {
    return '/login'
  }
  if ((to.path === '/login' || to.path === '/register') && isLoggedIn && !to.query.add) {
    return '/dashboard'
  }
})

export default router
