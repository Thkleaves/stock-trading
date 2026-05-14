import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Trade } from '@/types'

export const useTradeStore = defineStore('trade', () => {
  const trades = ref<Trade[]>([])
  const lastAppliedEventSeq = ref(0)

  const recentTrades = computed(() =>
    [...trades.value].sort((a, b) => b.time - a.time)
  )

  function setTrades(list: Trade[]) {
    trades.value = list
  }

  function resetEventSeq() {
    lastAppliedEventSeq.value = 0
  }

  function tryApplySeq(eventSeq: number | undefined): 'ok' | 'skip' | 'gap' {
    if (eventSeq === undefined || eventSeq === 0) return 'ok'
    if (eventSeq <= lastAppliedEventSeq.value) return 'skip'
    if (eventSeq !== lastAppliedEventSeq.value + 1) return 'gap'
    lastAppliedEventSeq.value = eventSeq
    return 'ok'
  }

  function addTrade(trade: Trade) {
    const exists = trades.value.some((t) => t.id === trade.id)
    if (exists) return
    trades.value.unshift(trade)
  }

  function addTrades(list: Trade[]) {
    for (const trade of list) {
      addTrade(trade)
    }
  }

  return { trades, recentTrades, lastAppliedEventSeq, setTrades, resetEventSeq, tryApplySeq, addTrade, addTrades }
})
