const userSeqMap = new Map<string, number>()

export const eventSeqStore = {
  getNext(userId: string): number {
    const current = userSeqMap.get(userId) ?? 0
    const next = current + 1
    userSeqMap.set(userId, next)
    return next
  },

  getCurrent(userId: string): number {
    return userSeqMap.get(userId) ?? 0
  },

  reset(): void {
    userSeqMap.clear()
  },
}
