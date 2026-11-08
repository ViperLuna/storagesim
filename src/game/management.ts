// The desk jobs: the Leasing Agent works the waiting line, the Manager collects rent and deals with abandoned units.
// Neither walks anywhere, but both need a working office (power, reachable door), same as the janitor.
import type { GameState, OfflineSummary, Staff } from './types'
import * as S from '../data/staff'
import { UNITS } from '../data/units'
import { unitDef, unitRank } from './defs'
import { log } from './log'
import { aOrAn, money } from './format'
import { staffBlocker } from './staff'
import { decline, eligibleUnits, fixedSale, offerUnit, startAuction } from './actions'

const hired = (state: GameState, role: string): Staff | undefined => state.staff.find(s => s.role === role)

/** Is a Leasing Agent on the job right now? (Hired, and the office works.) */
export const leasingAgentWorking = (state: GameState) => !!hired(state, 'leasing') && !staffBlocker(state)

export function leasingRules(state: GameState): { minPct: Record<string, number>; allowUpsize: boolean } {
  const r = state.leasing
  const minPct: Record<string, number> = {}
  for (const u of UNITS) minPct[u.id] = r?.minPct?.[u.id] ?? S.LEASING_DEFAULT_MIN_PCT
  return { minPct, allowUpsize: r?.allowUpsize ?? false }
}

export function setLeasingMinPct(state: GameState, unitId: string, pct: number): void {
  const r = leasingRules(state)
  r.minPct[unitId] = Math.max(0, Math.min(S.LEASING_MIN_PCT_MAX, Math.round(pct)))
  state.leasing = r
}

export function setLeasingUpsize(state: GameState, allow: boolean): void {
  state.leasing = { ...leasingRules(state), allowUpsize: allow }
}

export const managerRules = (state: GameState) => ({ abandoned: state.manager?.abandoned ?? 'manual' as S.AbandonedPolicy })

export function setAbandonedPolicy(state: GameState, policy: S.AbandonedPolicy): void {
  state.manager = { abandoned: policy }
}

/** Lowest bid the agent will accept for this size. */
export const minBid = (state: GameState, unitId: string) => unitDef(unitId).listPrice * leasingRules(state).minPct[unitId] / 100

function stepLeasingAgent(state: GameState, agent: Staff, dt: number, summary?: OfflineSummary): void {
  const rules = leasingRules(state)
  const ready = state.prospects
    .filter(p => state.time - p.arrivedAt >= S.LEASING_DELAY)
    .sort((a, b) => b.bid - a.bid)
  let worked = false
  for (const p of ready) {
    if (p.bid < minBid(state, p.wants)) {
      decline(state, p.id)
      log(state, `🧑‍💼 Your Leasing Agent turned away ${p.name}: ${money(p.bid)}/pt for ${aOrAn(unitDef(p.wants).name)} is under your ${rules.minPct[p.wants]}% minimum.`)
      if (summary) summary.turnedAway++
      worked = true
      continue
    }
    const { exact, bigger } = eligibleUnits(state, p.wants)
    let target = exact[0]
    if (!target && rules.allowUpsize && !p.refusedUpsize && bigger.length) {
      target = [...bigger].sort((a, b) => unitRank(a.defId) - unitRank(b.defId))[0]
    }
    if (!target) continue // passes the rules, nothing open for them yet: they wait
    const r = offerUnit(state, p.id, target.id)
    worked = true
    if (r === null && summary) summary.leased++
  }
  if (worked) agent.workedSeconds = (agent.workedSeconds ?? 0) + Math.max(dt, 0.001)
}

function stepManager(state: GameState, manager: Staff, dt: number, summary?: OfflineSummary): void {
  let worked = false
  for (const it of state.items) {
    const u = it.unit
    if (!u || u.pending <= 0) continue
    state.money += u.pending
    if (summary) summary.collected += u.pending
    u.pending = 0
    worked = true
  }
  const policy = managerRules(state).abandoned
  if (policy !== 'manual') {
    for (const it of state.items.filter(i => i.unit?.status === 'abandoned')) {
      if (policy === 'sale') fixedSale(state, it.id)
      else startAuction(state, it.id)
      worked = true
    }
  }
  if (worked) manager.workedSeconds = (manager.workedSeconds ?? 0) + Math.max(dt, 0.001)
}

/** Runs online and offline. Staff can't work out of a dark or blocked office. */
export function stepManagement(state: GameState, dt: number, summary?: OfflineSummary): void {
  if (staffBlocker(state)) return
  const agent = hired(state, 'leasing')
  if (agent) stepLeasingAgent(state, agent, dt, summary)
  const manager = hired(state, 'manager')
  if (manager) stepManager(state, manager, dt, summary)
}
