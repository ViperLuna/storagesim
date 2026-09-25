// Staff simulation. The janitor walks the empty tiles from the office door to dirty units.
import type { GameState, Item, Staff } from './types'
import { bfsFrom, isAccessible, occupancy, pathTo, reachable, isWalkable } from './grid'
import { doorOutside, baseSize } from './geometry'
import { isPowered } from './power'
import { officeDef } from './defs'
import { log } from './log'
import * as S from '../data/staff'

export const office = (state: GameState) => state.items.find(i => i.kind === 'office')
export const officeSlots = (state: GameState) => {
  const o = office(state)
  return o ? officeDef(o.defId).slots : 0
}

const doorTile = (it: Item) => doorOutside(it.x, it.y, baseSize(it.kind, it.defId), it.rot)

export const janitorSpeed = (state: GameState) => S.JANITOR_SPEED_BASE + S.JANITOR_SPEED_PER_LEVEL * (state.upgrades.janitorSpeed ?? 0)
export const janitorCleanTime = (state: GameState) => S.JANITOR_CLEAN_BASE * S.JANITOR_CLEAN_MULT_PER_LEVEL ** (state.upgrades.janitorClean ?? 0)

/** Why staff can't work right now, if they can't. */
export function staffBlocker(state: GameState): string | null {
  const o = office(state)
  if (!o) return 'No office'
  if (!isPowered(state, o)) return 'Office has no power'
  if (!isAccessible(state, o, reachable(state))) return "Office door can't be reached"
  return null
}

/** Home tile: just outside the office door. */
export function homeTile(state: GameState): [number, number] | null {
  const o = office(state)
  return o ? doorTile(o) : null
}

function setIdle(s: Staff) {
  s.mode = 'idle'
  s.path = []
  s.targetId = undefined
}

/** Nearest unclaimed dirty unit by walking distance from where the janitor stands. */
function pickJob(state: GameState, s: Staff): boolean {
  const claimed = new Set(state.staff.filter(o => o !== s && o.targetId !== undefined).map(o => o.targetId))
  const sx = Math.round(s.x), sy = Math.round(s.y)
  const { dist, prev } = bfsFrom(state, sx, sy)
  let best: { item: Item; d: number; tx: number; ty: number } | null = null
  for (const it of state.items) {
    if (it.unit?.status !== 'dirty' || claimed.has(it.id) || it.id === state.heldId) continue
    const [tx, ty] = doorTile(it)
    if (tx < 0 || ty < 0 || tx >= state.size || ty >= state.size) continue
    const d = dist[ty * state.size + tx]
    if (d >= 0 && (!best || d < best.d)) best = { item: it, d, tx, ty }
  }
  if (!best) return false
  s.mode = 'toJob'
  s.targetId = best.item.id
  s.path = pathTo(state, prev, best.tx, best.ty)
  return true
}

function headHome(state: GameState, s: Staff): void {
  const home = homeTile(state)
  if (!home) return setIdle(s)
  const sx = Math.round(s.x), sy = Math.round(s.y)
  if (sx === home[0] && sy === home[1]) return setIdle(s)
  const { prev, dist } = bfsFrom(state, sx, sy)
  const k = home[1] * state.size + home[0]
  if (dist[k] < 0) {
    // Walled in somewhere — clock out and reappear at the office.
    s.x = home[0]; s.y = home[1]
    return setIdle(s)
  }
  s.mode = 'toOffice'
  s.targetId = undefined
  s.path = pathTo(state, prev, home[0], home[1])
}

/** Walk along the path for up to `budget` seconds. Returns leftover seconds. */
function walk(state: GameState, s: Staff, budget: number): number {
  const speed = janitorSpeed(state)
  const occ = occupancy(state)
  while (budget > 0 && s.path.length) {
    const [nx, ny] = s.path[0]
    if (!isWalkable(state, nx, ny, occ)) {
      // Someone built in the way — re-plan.
      if (s.mode === 'toJob') {
        setIdle(s)
        if (!pickJob(state, s)) headHome(state, s)
      } else headHome(state, s)
      return budget
    }
    const d = Math.hypot(nx - s.x, ny - s.y)
    const t = d / speed
    if (t <= budget) {
      s.x = nx; s.y = ny
      s.path.shift()
      budget -= t
    } else {
      s.x += ((nx - s.x) / d) * speed * budget
      s.y += ((ny - s.y) / d) * speed * budget
      budget = 0
    }
  }
  return budget
}

function updateJanitor(state: GameState, s: Staff, dt: number) {
  let budget = dt
  for (let guard = 0; guard < 20 && budget > 0; guard++) {
    if (s.mode === 'idle' || s.mode === 'toOffice') {
      // Not committed to anything: grab the nearest job if there is one.
      if (pickJob(state, s)) continue
      if (s.mode === 'idle') {
        headHome(state, s)
        if (s.mode === 'idle') return
      }
      budget = walk(state, s, budget)
      if (!s.path.length) setIdle(s)
      continue
    }
    if (s.mode === 'toJob') {
      const target = state.items.find(i => i.id === s.targetId)
      if (target?.unit?.status !== 'dirty') { setIdle(s); continue }
      budget = walk(state, s, budget)
      if (s.mode === 'toJob' && !s.path.length) {
        s.mode = 'cleaning'
        s.cleanLeft = janitorCleanTime(state)
      }
      continue
    }
    if (s.mode === 'cleaning') {
      const target = state.items.find(i => i.id === s.targetId)
      if (target?.unit?.status !== 'dirty') { setIdle(s); continue }
      const used = Math.min(budget, s.cleanLeft)
      s.cleanLeft -= used
      budget -= used
      if (s.cleanLeft <= 0) {
        target.unit.status = 'vacant'
        target.unit.dirtySince = undefined
        log(state, `🧹 Janitor cleaned ${target.label}. Ready to rent!`, { tone: 'good', focusId: target.id })
        setIdle(s)
      }
    }
  }
}

export function stepStaff(state: GameState, dt: number) {
  if (!state.staff.length) return
  const blocked = staffBlocker(state)
  for (const s of state.staff) {
    if (blocked) continue // can't see what they're doing / can't get out
    if (s.role === 'janitor') updateJanitor(state, s, dt)
  }
}

export function payrollTotal(state: GameState): number {
  return state.staff.reduce((sum, s) => sum + (S.STAFF.find(d => d.id === s.role)?.wage ?? 0), 0)
}
