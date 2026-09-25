// Player actions. Each mutates the given state and returns a short error string on failure.
import type { GameState, Item, ItemKind, Rot } from './types'
import { canPlace } from './grid'
import { createRun, newUnit } from './init'
import { defCost, defName, nextTier, unitDef, unitRank } from './defs'
import { log } from './log'
import { money } from './format'
import * as E from '../data/economy'
import * as T from '../data/tenants'
import { requirementFor, rentMultiplierFor } from '../data/rebirths'
import { newLease } from './sim'

type Result = string | null

export function place(state: GameState, kind: ItemKind, defId: string, x: number, y: number, rot: Rot): Result {
  const cost = defCost(kind, defId)
  if (state.money < cost) return 'Not enough money'
  if (kind !== 'unit' && state.items.some(i => i.kind === kind)) return `Only one ${kind} per plot`
  if (!canPlace(state, kind, defId, x, y, rot)) return "Doesn't fit there"
  state.money -= cost
  if (kind === 'unit') {
    const it = newUnit(state, defId, x, y, rot)
    state.items.push(it)
  } else {
    state.items.push({ id: state.nextId++, kind, defId, x, y, rot, on: true, placedAt: state.time, label: defName(kind, defId) })
  }
  return null
}

export function move(state: GameState, id: number, x: number, y: number, rot: Rot): Result {
  const it = state.items.find(i => i.id === id)
  if (!it) return 'Missing item'
  if (!canPlace(state, it.kind, it.defId, x, y, rot, [id])) return "Doesn't fit there"
  it.x = x; it.y = y; it.rot = rot
  return null
}

export function upgradeCost(it: Item): number | undefined {
  const next = nextTier(it)
  if (!next) return undefined
  return Math.max(0, defCost(it.kind, next) - defCost(it.kind, it.defId) * E.SELL_REFUND)
}

/** Upgrade = place the next tier anywhere valid; the old one's spot counts as free. */
export function upgrade(state: GameState, id: number, x: number, y: number, rot: Rot): Result {
  const it = state.items.find(i => i.id === id)
  const next = it && nextTier(it)
  if (!it || !next) return 'Nothing to upgrade to'
  const cost = upgradeCost(it)!
  if (state.money < cost) return 'Not enough money'
  if (!canPlace(state, it.kind, next, x, y, rot, [id])) return "Doesn't fit there"
  state.money -= cost
  it.defId = next; it.x = x; it.y = y; it.rot = rot
  it.label = defName(it.kind, next)
  log(state, `⬆️ Upgraded to ${it.label}.`, { tone: 'good', focusId: it.id })
  return null
}

export function sellValue(state: GameState, it: Item): number {
  const cost = defCost(it.kind, it.defId)
  return state.time - it.placedAt <= E.SELL_GRACE_SECONDS ? cost : cost * E.SELL_REFUND
}

export function sell(state: GameState, id: number): Result {
  const idx = state.items.findIndex(i => i.id === id)
  if (idx < 0) return 'Missing item'
  const it = state.items[idx]
  const u = it.unit
  if (u?.status === 'auction') return "Can't sell during an auction"
  if (u) state.money += u.pending
  if (u?.status === 'occupied' && u.tenant) {
    state.money -= u.tenant.deposit
    state.rating -= E.RATING_EVICTION_HIT
    log(state, `🚪 Evicted ${u.tenant.name} from ${it.label}. Deposit refunded, and they're leaving a bad review.`, { tone: 'bad' })
  }
  state.money += sellValue(state, it)
  state.items.splice(idx, 1)
  return null
}

/** Click a unit: collect its pile of rent, and clean it if the tenant moved out. */
export function collect(state: GameState, id: number): number {
  const u = state.items.find(i => i.id === id)?.unit
  if (!u) return 0
  const amt = u.pending
  state.money += amt
  u.pending = 0
  if (u.status === 'dirty') {
    u.status = 'vacant'
    u.dirtySince = undefined
  }
  return amt
}

export function toggle(state: GameState, id: number): void {
  const it = state.items.find(i => i.id === id)
  if (it && it.kind !== 'generator') it.on = !it.on
}

export function fixedSale(state: GameState, id: number): Result {
  const it = state.items.find(i => i.id === id)
  const u = it?.unit
  if (!it || !u || u.status !== 'abandoned') return 'Not abandoned'
  const offer = u.abandonOffer ?? 0
  state.money += offer
  u.status = 'vacant'
  u.abandonOffer = undefined
  log(state, `💵 Sold the contents of ${it.label} for ${money(offer)}.`, { tone: 'good' })
  return null
}

export function startAuction(state: GameState, id: number): Result {
  const it = state.items.find(i => i.id === id)
  const u = it?.unit
  if (!it || !u || u.status !== 'abandoned') return 'Not abandoned'
  u.status = 'auction'
  u.auctionEndsAt = state.time + auctionDuration(it)
  log(state, `🔨 ${it.label} is up for auction.`, { focusId: it.id })
  return null
}

export const auctionDuration = (it: Item) => unitDef(it.defId).timer * T.AUCTION_DURATION_FACTOR

/** Vacant, clean units a prospect could be offered: exact size, or bigger (upsize). */
export function eligibleUnits(state: GameState, wants: string): { exact: Item[]; bigger: Item[] } {
  const rank = unitRank(wants)
  const vacant = state.items.filter(i => i.unit?.status === 'vacant')
  return {
    exact: vacant.filter(i => i.defId === wants),
    bigger: vacant.filter(i => unitRank(i.defId) > rank),
  }
}

export function decline(state: GameState, prospectId: number): void {
  state.prospects = state.prospects.filter(p => p.id !== prospectId)
}

/** Offer a unit. Exact size = accepted. Bigger = they might refuse. */
export function offerUnit(state: GameState, prospectId: number, itemId: number): Result {
  const p = state.prospects.find(q => q.id === prospectId)
  const it = state.items.find(i => i.id === itemId)
  const u = it?.unit
  if (!p || !it || !u || u.status !== 'vacant') return 'Unit not available'
  const rank = unitRank(it.defId), wantRank = unitRank(p.wants)
  if (rank < wantRank) return 'Too small'
  if (rank > wantRank) {
    if (p.refusedUpsize) return 'Already refused'
    if (Math.random() >= T.UPSIZE_ACCEPT_CHANCE) {
      p.refusedUpsize = true
      log(state, `🙅 ${p.name} turned down the bigger unit. People are weird.`)
      return 'refused'
    }
  }
  const deposit = p.bid * rentMultiplierFor(state.rebirth)
  state.money += deposit
  u.status = 'occupied'
  u.progress = 0
  u.tenant = { name: p.name, bid: p.bid, deposit, vip: p.vip, leaseLeft: newLease(), anger: 0, complaintStage: 0 }
  decline(state, prospectId)
  log(state, `✅ ${p.name} moved into ${it.label}${rank > wantRank ? ' (upsized!)' : ''}. Deposit +${money(deposit)}.`, { tone: 'good', focusId: it.id })
  return null
}

export interface RequirementCheck { label: string; met: boolean }

export function rebirthChecks(state: GameState): RequirementCheck[] {
  const req = requirementFor(state.rebirth)
  const checks: RequirementCheck[] = [{ label: `${money(req.money)} cash on hand`, met: state.money >= req.money }]
  if (req.sign) checks.push({ label: 'Own a sign', met: state.items.some(i => i.kind === 'sign') })
  if (req.employee) checks.push({ label: 'At least one employee (coming soon)', met: false })
  return checks
}

export function canRebirth(state: GameState): boolean {
  return rebirthChecks(state).every(c => c.met)
}

export function rebirth(state: GameState): GameState | null {
  if (!canRebirth(state)) return null
  const next = createRun(state.rebirth + 1)
  log(next, `🔁 Rebirth #${next.rebirth}! Bigger lot (${next.size}×${next.size}), rent ×${rentMultiplierFor(next.rebirth)}.`, { tone: 'good', toast: true })
  return next
}
