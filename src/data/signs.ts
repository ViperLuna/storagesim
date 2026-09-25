// Advertising signs. Only one sign per plot; bigger sign = faster prospects.

export interface SignDef {
  id: string
  name: string
  w: number
  h: number
  cost: number
  /** Multiplies the prospect spawn rate while powered. */
  spawnBoost: number
  power: number
  color: string
  unlockRebirth: number
  /** Next tier for the Upgrade button. */
  next?: string
}

export const SIGNS: SignDef[] = [
  { id: 'sign-small', name: 'Small Sign', w: 1, h: 1, cost: 200, spawnBoost: 1.5, power: 1, color: '#e0c341', unlockRebirth: 0, next: 'sign-medium' },
  { id: 'sign-medium', name: 'Medium Sign', w: 1, h: 2, cost: 2500, spawnBoost: 2.25, power: 2, color: '#e09a41', unlockRebirth: 1, next: 'sign-billboard' },
  { id: 'sign-billboard', name: 'Billboard', w: 2, h: 3, cost: 30000, spawnBoost: 3.5, power: 6, color: '#e06441', unlockRebirth: 3 },
]
