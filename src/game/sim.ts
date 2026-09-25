import type { GameState, Item, OfflineSummary, Tenant } from './types'
import * as T from '../data/tenants'
import * as E from '../data/economy'
import { UNPOWERED_RENT } from '../data/power'
import { rentMultiplierFor } from '../data/rebirths'
import { isAccessible, reachable } from './grid'
import { isPowered, isTripped } from './power'
import { unitDef, signDef } from './defs'
import { log } from './log'
import { expWait, rand, randInt, weighted } from './random'
import { makeProspect, stars } from './tenants'
import { money } from './format'

export interface StepOptions {
  offline?: boolean
  summary?: OfflineSummary
}

/** Payout multiplier applied to rent (rebirth + 5-star bonus). Deposits skip the star bonus. */
export function rentMultiplier(state: GameState): number {
  const starBonus = state.rating >= E.RATING_MAX ? 1 + E.FIVE_STAR_RENT_BONUS : 1
  return rentMultiplierFor(state.rebirth) * starBonus
}

export function spawnRate(state: GameState): number {
  const sign = state.items.find(i => i.kind === 'sign')
  const boost = sign && isPowered(state, sign) ? signDef(sign.defId).spawnBoost : 1
  const ratingFactor = 0.7 + 0.1 * stars(state) // 3★ = 1.0
  return boost * ratingFactor
}

export function newLease(): number {
  return randInt(T.LEASE_MIN, T.LEASE_MAX)
}

function endLease(state: GameState, item: Item, tenant: Tenant, s?: OfflineSummary) {
  const u = item.unit!
  if (s) s.leasesEnded++
  const outcome = weighted<'renew' | 'vacate' | 'abandon'>([
    ['renew', T.LEASE_END.renew], ['vacate', T.LEASE_END.vacate], ['abandon', T.LEASE_END.abandon],
  ])
  if (outcome === 'renew') {
    tenant.leaseLeft = newLease()
    if (s) s.renewed++
    log(state, `🔁 ${tenant.name} renewed their lease on ${item.label}.`, { tone: 'good', focusId: item.id })
  } else if (outcome === 'vacate') {
    u.status = 'dirty'
    u.tenant = undefined
    u.progress = 0
    u.dirtySince = state.time
    if (s) s.vacated++
    log(state, `📦 ${tenant.name} moved out of ${item.label}. Click it to collect & clean.`, { focusId: item.id, toast: true })
  } else {
    u.status = 'abandoned'
    u.tenant = undefined
    u.progress = 0
    u.abandonOffer = Math.round(tenant.bid * rand(T.ABANDON_OFFER_MIN, T.ABANDON_OFFER_MAX) * rentMultiplierFor(state.rebirth))
    if (s) s.abandoned++
    log(state, `🏚️ ${tenant.name} abandoned ${item.label}! Sell the contents or auction them.`, { tone: 'bad', focusId: item.id, toast: true })
  }
}

function updateOccupied(state: GameState, item: Item, reach: Set<number>, dt: number, mult: number, s?: OfflineSummary) {
  const u = item.unit!
  const tenant = u.tenant!
  if (!isAccessible(state, item, reach)) {
    tenant.anger += dt
    if (tenant.anger >= T.ANGER_MOVE_OUT) {
      state.money -= tenant.deposit
      u.status = 'vacant'
      u.tenant = undefined
      u.progress = 0
      if (s) s.ragequit++
      log(state, `😡 ${tenant.name} moved out of ${item.label} — couldn't get to their stuff. Deposit refunded (${money(tenant.deposit)}).`, { tone: 'bad', focusId: item.id, toast: true })
    } else if (tenant.anger >= T.ANGER_STAGE_2 && tenant.complaintStage < 2) {
      tenant.complaintStage = 2
      log(state, `😤 ${tenant.name} is VERY annoyed they can't reach ${item.label}.`, { tone: 'bad', focusId: item.id, toast: true })
    } else if (tenant.anger >= T.ANGER_GRACE && tenant.complaintStage < 1) {
      tenant.complaintStage = 1
      log(state, `😠 ${tenant.name} can't get to their storage unit (${item.label}).`, { tone: 'bad', focusId: item.id, toast: true })
    }
    return // timer paused while cut off
  }
  if (tenant.complaintStage > 0) log(state, `🙂 ${tenant.name} can reach ${item.label} again.`, { tone: 'good', focusId: item.id })
  tenant.anger = 0
  tenant.complaintStage = 0

  const def = unitDef(item.defId)
  const rate = isPowered(state, item) ? 1 : UNPOWERED_RENT
  u.progress += dt
  while (u.progress >= def.timer && u.status === 'occupied') {
    u.progress -= def.timer
    const pay = tenant.bid * mult * rate
    u.pending += pay
    if (s) s.rent += pay
    tenant.leaseLeft--
    if (tenant.leaseLeft <= 0) endLease(state, item, tenant, s)
  }
}

function businessTick(state: GameState) {
  let issues = 0
  for (const it of state.items) {
    const u = it.unit
    if (!u) continue
    if (u.status === 'occupied' && u.tenant!.anger >= T.ANGER_GRACE) issues++
    if (u.status === 'dirty' && state.time - (u.dirtySince ?? state.time) >= E.DIRTY_TICKS_BEFORE_ISSUE * E.TICK_SECONDS) issues++
  }
  if (state.tripped) issues++

  if (issues) state.rating -= E.RATING_LOSS_PER_ISSUE * issues
  else state.rating = Math.min(E.RATING_MAX, state.rating + E.RATING_GAIN_PER_TICK)

  if (state.rating <= 0) {
    if (state.rating <= state.ratingAtLastTick) state.failStrikes++
    else state.failStrikes = 0
    if (state.failStrikes >= E.FAIL_STRIKES) {
      state.levelOver = 'rating'
      log(state, `💀 Your rating hit rock bottom. Every tenant pulled out.`, { tone: 'bad', toast: true })
    } else {
      log(state, `⚠️ Rating critical! ${state.failStrikes}/${E.FAIL_STRIKES} — fix things or everyone leaves.`, { tone: 'bad', toast: true })
    }
  } else {
    state.failStrikes = 0
  }
  state.ratingAtLastTick = state.rating
}

/** Advance the simulation by dt seconds. Mutates state. Used for live play AND offline catch-up. */
export function step(state: GameState, dt: number, opts: StepOptions = {}): void {
  if (state.levelOver || dt <= 0) return
  state.time += dt

  const wasTripped = state.tripped
  state.tripped = isTripped(state)
  if (state.tripped && !wasTripped) log(state, `⚡ Power grid overloaded! Everything's dark. Switch something off, sell it, or upgrade your power.`, { tone: 'bad', toast: true })
  if (!state.tripped && wasTripped) log(state, `💡 Power restored.`, { tone: 'good', toast: true })

  const reach = reachable(state)
  const mult = rentMultiplier(state)
  for (const item of state.items) {
    const u = item.unit
    if (!u || item.id === state.heldId) continue
    if (u.status === 'occupied') updateOccupied(state, item, reach, dt, mult, opts.summary)
    else if (u.status === 'auction' && state.time >= (u.auctionEndsAt ?? 0)) finishAuction(state, item, opts.summary)
  }

  // Prospects: nobody's at the desk while you're offline, so no new arrivals then.
  const before = state.prospects.length
  state.prospects = state.prospects.filter(p => state.time - p.arrivedAt < T.PROSPECT_PATIENCE)
  if (state.prospects.length < before && !opts.offline) log(state, `🚶 A prospect got tired of waiting and left.`)
  if (!opts.offline) {
    state.nextProspectIn -= dt * spawnRate(state)
    if (state.nextProspectIn <= 0) {
      state.nextProspectIn = expWait(T.BASE_SPAWN_SECONDS)
      if (state.prospects.length < T.MAX_PROSPECTS) addProspect(state)
    }
  }

  state.tickIn -= dt
  while (state.tickIn <= 0 && !state.levelOver) {
    state.tickIn += E.TICK_SECONDS
    businessTick(state)
  }
}

export function addProspect(state: GameState, forceVip = false) {
  const p = makeProspect(state, forceVip)
  state.prospects.push(p)
  const d = unitDef(p.wants)
  log(state, `${p.vip ? '👑 VIP ' : '🧍 '}${p.name} wants a ${d.name} — offering ${money(p.bid)}/pt.`, { tone: p.vip ? 'vip' : 'info', openTenants: true, toast: true })
}

function finishAuction(state: GameState, item: Item, s?: OfflineSummary) {
  const u = item.unit!
  const offer = u.abandonOffer ?? 0
  const win = Math.random() < T.AUCTION_WIN_CHANCE
  const range = win ? T.AUCTION_WIN_RANGE : T.AUCTION_LOSE_RANGE
  const result = Math.round(offer * rand(range[0], range[1]))
  state.money += result
  u.status = 'vacant'
  u.abandonOffer = undefined
  u.auctionEndsAt = undefined
  if (s) s.auctions++
  log(state, `🔨 Auction for ${item.label} closed at ${money(result)} (offer was ${money(offer)})${win ? ' 🎉' : ' 😬'}`, { tone: win ? 'good' : 'bad', focusId: item.id, toast: true })
}

export function emptySummary(seconds: number): OfflineSummary {
  return { seconds, rent: 0, leasesEnded: 0, renewed: 0, vacated: 0, abandoned: 0, ragequit: 0, auctions: 0 }
}

/** Simulate time away. Rent piles up on units; you still click to collect it. */
export function catchUp(state: GameState, seconds: number): OfflineSummary {
  seconds = Math.min(seconds, E.OFFLINE_CAP_HOURS * 3600)
  const summary = emptySummary(seconds)
  const steps = Math.min(Math.ceil(seconds / 2), 20000)
  const dt = seconds / Math.max(1, steps)
  for (let i = 0; i < steps && !state.levelOver; i++) step(state, dt, { offline: true, summary })
  return summary
}
