// Offices house staff. One office per plot. Bigger offices are new buildings (no upgrades).

export interface OfficeDef {
  id: string
  name: string
  w: number
  h: number
  cost: number
  power: number
  /** Staff members it can hold. */
  slots: number
  color: string
  unlockRebirth: number
}

export const OFFICES: OfficeDef[] = [
  { id: 'office-small', name: 'Office', w: 2, h: 2, cost: 1500, power: 5, slots: 1, color: '#c9ccd4', unlockRebirth: 0 },
  // Security office (monitors & computers) — arrives with cameras.
  { id: 'office-security', name: 'Security Office', w: 3, h: 3, cost: 60000, power: 9, slots: 2, color: '#b3b8c4', unlockRebirth: 5 },
]
