export type Rot = 0 | 1 | 2 | 3
export type ItemKind = 'unit' | 'sign' | 'generator' | 'office'

export interface Tenant {
  name: string
  /** Agreed price per point (before multipliers). */
  bid: number
  /** Deposit actually paid (= first point, multiplied). */
  deposit: number
  vip: boolean
  leaseLeft: number
  /** Seconds spent unable to reach the unit. */
  anger: number
  complaintStage: 0 | 1 | 2
}

export type UnitStatus = 'vacant' | 'occupied' | 'dirty' | 'abandoned' | 'auction'

export interface UnitState {
  status: UnitStatus
  tenant?: Tenant
  /** Seconds into the current point's timer. */
  progress: number
  /** Rent sitting on the unit waiting to be clicked. */
  pending: number
  dirtySince?: number
  abandonOffer?: number
  auctionEndsAt?: number
}

export interface Item {
  id: number
  kind: ItemKind
  defId: string
  x: number
  y: number
  rot: Rot
  on: boolean
  placedAt: number
  label: string
  unit?: UnitState
}

export interface Prospect {
  id: number
  name: string
  wants: string
  bid: number
  vip: boolean
  arrivedAt: number
  /** Already turned down an upsize offer. */
  refusedUpsize?: boolean
}

export interface LogEntry {
  id: number
  time: number
  text: string
  tone: 'info' | 'good' | 'bad' | 'vip'
  focusId?: number
  openTenants?: boolean
  /** Pop a toast for this entry. */
  toast?: boolean
}

export interface OfflineSummary {
  seconds: number
  rent: number
  leasesEnded: number
  renewed: number
  vacated: number
  abandoned: number
  ragequit: number
  auctions: number
}

export interface Staff {
  id: number
  role: string
  /** Tile coordinates (fractional while walking). */
  x: number
  y: number
  mode: 'idle' | 'toJob' | 'cleaning' | 'toOffice'
  /** Remaining tiles to walk. */
  path: [number, number][]
  targetId?: number
  cleanLeft: number
}

export interface Loan {
  owed: number
  installment: number
  graceLeft: number
}

export interface GameState {
  version: 3
  rebirth: number
  size: number
  money: number
  /** Can go below zero internally; displayed clamped. */
  rating: number
  ratingAtLastTick: number
  failStrikes: number
  items: Item[]
  nextId: number
  nextLabel: number
  prospects: Prospect[]
  nextProspectIn: number
  /** Game seconds elapsed this run. */
  time: number
  tickIn: number
  log: LogEntry[]
  /** Item currently picked up (timer paused). */
  heldId?: number
  levelOver?: 'rating' | 'bankrupt'
  staff: Staff[]
  upgrades: Record<string, number>
  loan?: Loan
  bankruptStrikes: number
  cashAtLastPayroll: number
  lastSaved: number
  /** Items whose power is out this frame (derived, but cached for UI). */
  tripped: boolean
}
