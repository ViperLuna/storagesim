// Staff. Wages are paid every payroll (see TICK_SECONDS in economy.ts).

export interface StaffDef {
  id: string
  name: string
  icon: string
  hireCost: number
  /** Paid each payroll. */
  wage: number
  /** Full wage for any payday they did some work; nothing if idle all period. Otherwise paid by time worked. */
  flatPay?: boolean
  unlockRebirth: number
  /** Code supports many; capped for now. */
  max: number
  /** Only works out of this office type. */
  needsOffice?: string
}

export const STAFF: StaffDef[] = [
  { id: 'janitor', name: 'Janitor', icon: '🧹', hireCost: 250, wage: 250, flatPay: true, unlockRebirth: 0, max: 1 },
  // Sits in the Security Office watching the monitors. Paid only while there are working cameras.
  { id: 'security', name: 'Security', icon: '💂', hireCost: 2000, wage: 150, unlockRebirth: 5, max: 1, needsOffice: 'office-security' },
]

// Janitor tuning
export const JANITOR_SPEED_BASE = 1.5 // tiles per second
export const JANITOR_SPEED_PER_LEVEL = 0.5
/** Janitor's clean time as a multiple of yours (he starts slower; mop upgrades fix that). */
export const JANITOR_CLEAN_FACTOR = 1.5
export const JANITOR_CLEAN_MULT_PER_LEVEL = 0.8

export interface UpgradeDef {
  id: string
  name: string
  desc: string
  /** Cost of each level; length = max level. */
  costs: number[]
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'janitorSpeed', name: 'Janitor shoes', desc: '+0.5 tiles/sec walking speed', costs: [300, 1200, 5000, 20000] },
  { id: 'janitorClean', name: 'Better mop', desc: 'Cleans 20% faster', costs: [300, 1200, 5000, 20000] },
]
