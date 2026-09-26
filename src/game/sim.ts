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
import { aOrAn, money } from './format'
import { payrollTotal, stepStaff } from './staff'
import { startNextClean } from './actions'

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

/** Payroll, loan repayment, and the bankruptcy check. Offline, payroll pauses once cash hits $0. */
function payday(state: GameState, offline: boolean) {
  const wages = payrollTotal(state)
  const loan = state.loan
  if (offline && state.money <= 0) return
  if (wages > 0) {
    state.money -= wages
    log(state, `💸 Payroll: -${money(wages)}`, { toast: !offline })
  }
  if (loan) {
    if (loan.graceLeft > 0) loan.graceLeft--
    else {
      const pay = Math.min(loan.installment, loan.owed)
      state.money -= pay
      loan.owed -= pay
      log(state, `🏦 Loan payment: -${money(pay)} (${money(loan.owed)} left)`, { toast: !offline })
      if (loan.owed <= 0.005) {
        state.loan = undefined
        log(state, `🏦 Loan paid off!`, { tone: 'good', toast: true })
      }
    }
  }
  if (wages === 0 && !loan) {
    state.bankruptStrikes = 0
    state.cashAtLastPayroll = state.money
    return
  }
  if (state.money < 0 && !offline) {
    if (state.money <= state.cashAtLastPayroll) state.bankruptStrikes++
    else state.bankruptStrikes = 0
    if (state.bankruptStrikes >= E.FAIL_STRIKES) {
      state.levelOver = 'bankrupt'
      log(state, `💀 Bankrupt. The bank took the keys.`, { tone: 'bad', toast: true })
    } else if (state.bankruptStrikes > 0) {
      log(state, `⚠️ In the red and not recovering! Strike ${state.bankruptStrikes}/${E.FAIL_STRIKES} — sell something, fire someone, or take a loan.`, { tone: 'bad', toast: true })
    }
  } else {
    state.bankruptStrikes = 0
  }
  state.cashAtLastPayroll = state.money
}

export interface RatingIssue { text: string; focusId?: number }

/** Everything that will count against your rating at the next tick. */
export function ratingIssues(state: GameState, offline = false): RatingIssue[] {
  const out: RatingIssue[] = []
  for (const it of state.items) {
    const u = it.unit
    if (!u) continue
    if (u.status === 'occupied' && u.tenant!.anger >= T.ANGER_GRACE) out.push({ text: `${u.tenant!.name} can't reach ${it.label}`, focusId: it.id })
    // Nobody can mop while you're away (unless you have a janitor), so dirty units only count online.
    if (!offline && u.status === 'dirty' && state.time - (u.dirtySince ?? state.time) >= E.DIRTY_TICKS_BEFORE_ISSUE * E.TICK_SECONDS) out.push({ text: `${it.label} has been dirty too long`, focusId: it.id })
  }
  if (state.tripped) out.push({ text: 'Power is out (overloaded grid)' })
  return out
}

function businessTick(state: GameState, offline: boolean) {
  payday(state, offline)
  if (state.levelOver) return
  const issues = ratingIssues(state, offline).length

  // Your rating never drops while you're away; it can still climb if everything's running clean.
  // It never goes below 0 — strikes track "still getting hit at zero".
  if (issues && !offline) state.rating = Math.max(0, state.rating - E.RATING_LOSS_PER_ISSUE * issues)
  else if (!issues) state.rating = Math.min(E.RATING_MAX, state.rating + E.RATING_GAIN_PER_TICK)

  if (offline) {
    state.failStrikes = 0
  } else if (state.rating <= 0) {
    if (issues) state.failStrikes++
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

  stepPlayerCleaning(state, dt)
  stepStaff(state, dt)

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
    businessTick(state, !!opts.offline)
  }
}

function stepPlayerCleaning(state: GameState, dt: number) {
  const pc = state.playerClean
  let budget = dt
  while (budget > 0 && pc.queue.length) {
    const it = state.items.find(i => i.id === pc.queue[0])
    if (!it || it.unit?.status !== 'dirty' || it.id === state.heldId) {
      if (it && it.id === state.heldId) return // paused while you're moving it
      pc.queue.shift()
      startNextClean(state)
      continue
    }
    const used = Math.min(budget, pc.left)
    pc.left -= used
    budget -= used
    if (pc.left <= 0) {
      it.unit.status = 'vacant'
      it.unit.dirtySince = undefined
      log(state, `✨ You cleaned ${it.label}. Ready to rent!`, { tone: 'good', focusId: it.id })
      pc.queue.shift()
      startNextClean(state)
    }
  }
}

export function addProspect(state: GameState, forceVip = false) {
  const p = makeProspect(state, forceVip)
  state.prospects.push(p)
  const d = unitDef(p.wants)
  log(state, `${p.vip ? '👑 VIP ' : '🧍 '}${p.name} wants ${aOrAn(d.name)} — offering ${money(p.bid)}/pt.`, { tone: p.vip ? 'vip' : 'info', openTenants: true, toast: true })
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
