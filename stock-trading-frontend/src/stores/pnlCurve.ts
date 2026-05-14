import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PnlCurveEntry } from '@/types'

export const usePnlCurveStore = defineStore('pnlCurve', () => {
  const data = ref<PnlCurveEntry[]>([])

  function setData(entries: PnlCurveEntry[]) {
    data.value = entries
  }

  function clear() {
    data.value = []
  }

  return { data, setData, clear }
})
