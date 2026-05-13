import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Order } from '@/types'

export const useOrderStore = defineStore('order', () => {
  const orders = ref<Order[]>([])

  const pendingOrders = computed(() =>
    orders.value.filter((o) => o.status === 'pending' || o.status === 'partial')
  )

  const completedOrders = computed(() =>
    orders.value.filter((o) => o.status === 'filled' || o.status === 'cancelled')
  )

  function setOrders(list: Order[]) {
    orders.value = list
  }

  function upsertOrder(order: Order) {
    const idx = orders.value.findIndex((o) => o.id === order.id)
    if (idx >= 0) {
      orders.value[idx] = order
    } else {
      orders.value.unshift(order)
    }
  }

  return { orders, pendingOrders, completedOrders, setOrders, upsertOrder }
})
