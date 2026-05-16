import { v4 as uuid } from 'uuid'
import type { User } from '../types/index.js'
import { INITIAL_BALANCE } from '../types/index.js'

const users = new Map<string, User>()

export const usersStore = {
  create(username: string, password: string, initialStockCodes: string[]): User {
    const id = uuid()
    const user: User = { id, username, password, balance: INITIAL_BALANCE, frozenBalance: 0, initialStockCodes }
    users.set(id, user)
    return user
  },

  getById(id: string): User | undefined {
    return users.get(id)
  },

  findByUsername(username: string): User | undefined {
    for (const user of users.values()) {
      if (user.username === username) {
        return user
      }
    }
    return undefined
  },

  updateBalance(id: string, delta: number): User | undefined {
    const user = users.get(id)
    if (!user) return undefined
    user.balance += delta
    return user
  },

  freezeBalance(id: string, amount: number): User | undefined {
    const user = users.get(id)
    if (!user) return undefined
    user.balance -= amount
    user.frozenBalance += amount
    return user
  },

  unfreezeBalance(id: string, amount: number): User | undefined {
    const user = users.get(id)
    if (!user) return undefined
    user.balance += amount
    user.frozenBalance -= amount
    return user
  },

  consumeFrozen(id: string, amount: number): User | undefined {
    const user = users.get(id)
    if (!user) return undefined
    user.frozenBalance -= amount
    return user
  },

  existsByUsername(username: string): boolean {
    return this.findByUsername(username) !== undefined
  },

  _unsafeSet(user: User): void {
    users.set(user.id, user)
  },

  clear(): void {
    users.clear()
  },

  getAll(): User[] {
    return Array.from(users.values())
  },

  loadFrom(usersList: User[]): void {
    users.clear()
    for (const u of usersList) {
      users.set(u.id, u)
    }
  },
}
