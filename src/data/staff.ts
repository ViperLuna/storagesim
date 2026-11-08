// Staff. Wages are paid every payroll (see TICK_SECONDS in economy.ts).

export interface StaffDef {
  id: string
  name: string
  icon: string
  hireCost: number
  /** Paid each payroll. */
  wage: number
  /** While you're away: full wage for any payday they did some work, nothing if idle. Otherwise paid by time worked.
   *  (While you're playing, everyone gets full pay.) */
  flatPay?: boolean
  unlockRebirth: number
  /** Code supports many; capped for now. */
  max: number
  /** Only works out of this office or a bigger one. */
  needsOffice?: string
}

export const STAFF: StaffDef[] = [
  { id: 'janitor', name: 'Janitor', icon: '🧹', hireCost: 250, wage: 250, flatPay: true, unlockRebirth: 0, max: 1 },
  // Sits in the Security Office watching the monitors. Paid only while there are working cameras.
  { id: 'security', name: 'Security', icon: '💂', hireCost: 2000, wage: 2000, unlockRebirth: 5, max: 1, needsOffice: 'office-security' },
  // Leases prospects by your rules, even while you're away.
  { id: 'leasing', name: 'Leasing Agent', icon: '🧑‍💼', hireCost: 25000, wage: 5000, flatPay: true, unlockRebirth: 10, max: 1, needsOffice: 'office-main' },
  // Collects rent and handles abandoned units.
  { id: 'manager', name: 'Manager', icon: '👔', hireCost: 100000, wage: 10000, flatPay: true, unlockRebirth: 15, max: 1, needsOffice: 'office-hq' },
]

// Leasing Agent tuning
/** Default minimum bid, as % of list price, for every unit size. */
export const LEASING_DEFAULT_MIN_PCT = 90
/** Slider range for the minimum bid. */
export const LEASING_MIN_PCT_MAX = 150
/** Seconds a prospect waits before the agent gets to them (so you see them arrive). */
export const LEASING_DELAY = 3

export type AbandonedPolicy = 'manual' | 'sale' | 'auction'

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
