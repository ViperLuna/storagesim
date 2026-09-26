import type { GameState, Prospect } from './types'
import * as T from '../data/tenants'
import { UNITS } from '../data/units'
import { pick, rand, weighted } from './random'
import { unitDef } from './defs'
import { RATING_MAX } from '../data/economy'

/** Names currently on the lot: waiting prospects and current tenants. */
export function namesInUse(state: GameState): Set<string> {
  const names = new Set(state.prospects.map(p => p.name))
  for (const it of state.items) if (it.unit?.tenant) names.add(it.unit.tenant.name)
  return names
}

/** A random name nobody on the lot is already using. */
export function randomName(state: GameState): string {
  const taken = namesInUse(state)
  for (let i = 0; i < 200; i++) {
    const name = Math.random() < T.PUN_CHANCE ? pick(T.PUN_NAMES) : `${pick(T.FIRST_NAMES)} ${pick([...T.LAST_INITIALS])}.`
    if (!taken.has(name)) return name
  }
  // Absurdly crowded lot — add a number rather than duplicate.
  return `${pick(T.FIRST_NAMES)} ${pick([...T.LAST_INITIALS])}. ${taken.size}`
}

export const stars = (state: GameState) => Math.max(0, Math.min(RATING_MAX, state.rating))

export function makeProspect(state: GameState, forceVip = false): Prospect {
  const unlocked = UNITS.filter(u => u.unlockRebirth <= state.rebirth)
  const owned = [...new Set(state.items.filter(i => i.kind === 'unit').map(i => i.defId))]
  const wants = owned.length && Math.random() < T.OWNED_SIZE_BIAS
    ? pick(owned)
    : weighted(unlocked.map(u => [u.id, u.demand] as [string, number]))
  const list = unitDef(wants).listPrice
  // Average of two uniforms → most bids land near the middle of the range.
  const f = T.BID_MIN + (T.BID_MAX - T.BID_MIN) * ((Math.random() + Math.random()) / 2)
  const vipChance = T.VIP_CHANCE_MIN + (T.VIP_CHANCE_MAX - T.VIP_CHANCE_MIN) * (stars(state) / RATING_MAX)
  const vip = forceVip || Math.random() < vipChance
  let bid = list * f
  if (vip) bid = list * rand(T.VIP_BID_MIN, T.VIP_BID_MAX)
  bid = bid >= 20 ? Math.round(bid) : Math.round(bid * 100) / 100
  return { id: state.nextId++, name: randomName(state), wants, bid, vip, arrivedAt: state.time }
}
