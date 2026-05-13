import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Position } from '@/types'

export const usePositionStore = defineStore('position', () => {
  const positions = ref<Position[]>([])

  function setPositions(list: Position[]) {
    positions.value = list
  }

  return { positions, setPositions }
})
