// Storage unit catalog. Every number here is a placeholder for playtesting.
// Rule: bigger units take longer per point but earn more per hour AND per tile.

export interface UnitDef {
  id: string
  name: string
  w: number
  h: number
  /** Seconds per point (one payout). */
  timer: number
  /** List price per point — the "normal" bid. Tenant bids vary around this. */
  listPrice: number
  /** Build cost. */
  cost: number
  /** Seconds for YOU to clean it after a tenant moves out. */
  cleanTime: number
  /** Relative chance a random prospect wants this size. */
  demand: number
  /** Placeholder colour until real art exists. */
  color: string
  unlockRebirth: number
}

export const UNITS: UnitDef[] = [
  { id: 'locker', name: 'Locker', w: 1, h: 1, timer: 60, listPrice: 10, cost: 50, cleanTime: 10, demand: 5, color: '#4f8fd6', unlockRebirth: 0 },
  { id: 'small', name: 'Small', w: 1, h: 2, timer: 180, listPrice: 72, cost: 350, cleanTime: 15, demand: 3, color: '#3fae8f', unlockRebirth: 0 },
  { id: 'medium', name: 'Medium', w: 2, h: 2, timer: 540, listPrice: 540, cost: 2500, cleanTime: 25, demand: 2, color: '#d6a84f', unlockRebirth: 0 },
  { id: 'large', name: 'Large', w: 2, h: 3, timer: 1440, listPrice: 2592, cost: 12000, cleanTime: 40, demand: 1, color: '#d6744f', unlockRebirth: 0 },
  { id: 'xl', name: 'XL', w: 2, h: 4, timer: 3600, listPrice: 10560, cost: 50000, cleanTime: 60, demand: 0.5, color: '#a45fd6', unlockRebirth: 0 },
]

/** Units every run starts with, pre-placed (see game/init.ts for the pattern). */
export const STARTING_UNIT = 'locker'
export const STARTING_UNIT_COUNT = 3

/** Power drawn per tile a unit covers. */
export const UNIT_POWER_PER_TILE = 1
