import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Trade } from '@/types'

export const useTradeStore = defineStore('trade', () => {
  const trades = ref<Trade[]>([])

  const recentTrades = computed(() =>
    [...trades.value].sort((a, b) => b.time - a.time)
  )

  function setTrades(list: Trade[]) {
    trades.value = list
  }

  function addTrade(trade: Trade) {
    trades.value.unshift(trade)
  }

  return { trades, recentTrades, setTrades, addTrade }
})
