// Cameras & burglaries.
import type { Camera, GameState, Item } from './types'
import { CAMERAS, CAMERA_DIRS, type CameraDef } from '../data/cameras'
import * as C from '../data/cameras'
import { itemAt } from './grid'
import { doorOutside, baseSize, itemSize } from './geometry'
import { office, staffBlocker } from './staff'
import { log } from './log'
import { expWait, pick } from './random'
import { money } from './format'
import { SELL_REFUND, RATING_MAX } from '../data/economy'

export const cameraDef = (id: string): CameraDef => CAMERAS.find(c => c.id === id)!

/** Cameras mount on storage units and the sign. */
export function mountAt(state: GameState, x: number, y: number): Item | undefined {
  const it = itemAt(state, x, y)
  return it && (it.kind === 'unit' || it.kind === 'sign') ? it : undefined
}

export const cameraAt = (state: GameState, x: number, y: number, ignore?: number) =>
  state.cameras.find(c => c.x === x && c.y === y && c.id !== ignore)

/** Green/red for the camera ghost: must sit on a unit or sign, one camera per tile. */
export function canMountCamera(state: GameState, x: number, y: number, ignore?: number): boolean {
  return !!mountAt(state, x, y) && !cameraAt(state, x, y, ignore)
}

/** Does this camera's view reach the tile? (Sees through buildings.) */
export function covers(cam: Pick<Camera, 'x' | 'y' | 'dir'>, def: CameraDef, tx: number, ty: number): boolean {
  const dx = tx - cam.x, dy = ty - cam.y
  const d = Math.hypot(dx, dy)
  if (d > def.range) return false
  if (def.fov >= 360 || d === 0) return true
  const facing = (cam.dir * 360) / CAMERA_DIRS
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI
  const diff = Math.abs(((angle - facing + 540) % 360) - 180)
  return diff <= def.fov / 2
}

/** Cameras need the Security Office, a Security guard on duty, and the office running. */
export function securityBlocker(state: GameState): string | null {
  const o = office(state)
  if (!o || o.defId !== 'office-security') return 'Needs the Security Office'
  const b = staffBlocker(state)
  if (b) return b
  if (!state.staff.some(s => s.role === 'security')) return 'No Security guard hired'
  return null
}

export function cameraActive(state: GameState, cam: Camera): boolean {
  return cam.on && !state.tripped && !securityBlocker(state)
}

/** Is this tile watched by any working camera? */
export function isWatched(state: GameState, tx: number, ty: number): boolean {
  if (securityBlocker(state) || state.tripped) return false
  return state.cameras.some(c => c.on && covers(c, cameraDef(c.defId), tx, ty))
}

export const activeCameraCount = (state: GameState) => state.cameras.filter(c => cameraActive(state, c)).length

// ---- Actions ----

type Result = string | null

export function placeCamera(state: GameState, defId: string, x: number, y: number, dir: number): Result {
  const def = cameraDef(defId)
  if (state.money < def.cost) return 'Not enough money'
  if (!canMountCamera(state, x, y)) return 'Cameras mount on a unit or the sign (one per tile)'
  state.money -= def.cost
  state.cameras.push({ id: state.nextId++, defId, x, y, dir, on: true, placedAt: state.time })
  return null
}

export function moveCamera(state: GameState, id: number, x: number, y: number, dir: number): Result {
  const c = state.cameras.find(k => k.id === id)
  if (!c) return 'Missing camera'
  if (!canMountCamera(state, x, y, id)) return 'Cameras mount on a unit or the sign (one per tile)'
  c.x = x; c.y = y; c.dir = dir
  return null
}

export const cameraUpgradeCost = (c: Camera) => {
  const next = cameraDef(c.defId).next
  return next ? Math.max(0, cameraDef(next).cost - cameraDef(c.defId).cost * SELL_REFUND) : undefined
}

export function upgradeCamera(state: GameState, id: number): Result {
  const c = state.cameras.find(k => k.id === id)
  const next = c && cameraDef(c.defId).next
  if (!c || !next) return 'Already the best'
  const cost = cameraUpgradeCost(c)!
  if (state.money < cost) return 'Not enough money'
  state.money -= cost
  c.defId = next
  log(state, `⬆️ Upgraded to a ${cameraDef(next).name}.`, { tone: 'good' })
  return null
}

export function sellCamera(state: GameState, id: number): void {
  const c = state.cameras.find(k => k.id === id)
  if (!c) return
  state.money += cameraDef(c.defId).cost * SELL_REFUND
  state.cameras = state.cameras.filter(k => k.id !== id)
}

export function toggleCamera(state: GameState, id: number): void {
  const c = state.cameras.find(k => k.id === id)
  if (c) c.on = !c.on
}

// ---- Cameras ride along with the structure they're mounted on ----

export function camerasOn(state: GameState, it: Item): Camera[] {
  const fp = itemSize(it)
  return state.cameras.filter(c => c.x >= it.x && c.x < it.x + fp.w && c.y >= it.y && c.y < it.y + fp.h)
}

/** After an item moves/rotates/upgrades, keep its cameras on it at the same spot (clamped to the new shape). */
export function carryCameras(cams: Camera[], from: { x: number; y: number }, it: Item): void {
  const fp = itemSize(it)
  for (const c of cams) {
    c.x = it.x + Math.min(fp.w - 1, Math.max(0, c.x - from.x))
    c.y = it.y + Math.min(fp.h - 1, Math.max(0, c.y - from.y))
  }
}

export function sellCamerasOn(state: GameState, it: Item): number {
  const cams = camerasOn(state, it)
  for (const c of cams) sellCamera(state, c.id)
  return cams.length
}

// ---- Burglaries ----

/** A burglar has to get to the door: the tile outside it is what needs watching. */
export function doorWatched(state: GameState, it: Item): boolean {
  const [dx, dy] = doorOutside(it.x, it.y, baseSize(it.kind, it.defId), it.rot)
  return isWatched(state, dx, dy)
}

/** Is the tile outside the door in any camera's view, recording or not? */
export function doorCovered(state: GameState, it: Item): boolean {
  const [dx, dy] = doorOutside(it.x, it.y, baseSize(it.kind, it.defId), it.rot)
  return state.cameras.some(c => covers(c, cameraDef(c.defId), dx, dy))
}

/** Why a camera covering a door didn't catch anyone. */
function whyNobodyWatching(state: GameState): string {
  const b = securityBlocker(state)
  if (b) return b.charAt(0).toLowerCase() + b.slice(1)
  if (state.tripped) return 'the power was out'
  return 'the camera was switched off'
}

function neighbors(state: GameState, it: Item): Item[] {
  const fp = itemSize(it)
  return state.items.filter(o => {
    if (o === it || o.unit?.status !== 'occupied') return false
    const of = itemSize(o)
    const overlapX = o.x < it.x + fp.w && o.x + of.w > it.x
    const overlapY = o.y < it.y + fp.h && o.y + of.h > it.y
    const touchX = o.x + of.w === it.x || it.x + fp.w === o.x
    const touchY = o.y + of.h === it.y || it.y + fp.h === o.y
    return (overlapY && touchX) || (overlapX && touchY)
  })
}

function moveOut(state: GameState, it: Item, why: string) {
  const u = it.unit!
  const t = u.tenant!
  u.status = 'dirty'
  u.tenant = undefined
  u.progress = 0
  u.dirtySince = state.time
  log(state, `📦 ${t.name} ${why} ${it.label}.`, { tone: 'bad', focusId: it.id })
}

export function burglary(state: GameState, target?: Item): void {
  const occupied = state.items.filter(i => i.unit?.status === 'occupied')
  const it = target ?? (occupied.length ? pick(occupied) : undefined)
  if (!it?.unit?.tenant) return
  if (doorWatched(state, it)) {
    state.rating = Math.min(RATING_MAX, state.rating + C.RATING_BURGLAR_CAUGHT)
    log(state, `🚨 Security caught a burglar sneaking up to ${it.label}! 💂`, { tone: 'good', focusId: it.id, toast: true })
    return
  }
  state.rating = Math.max(0, state.rating - C.RATING_BURGLARY_HIT)
  const victim = it.unit!.tenant!.name
  const why = doorCovered(state, it)
    ? `A camera covers that door, but nobody was watching (${whyNobodyWatching(state)}).`
    : 'No camera covers that door.'
  log(state, `🚨 Break-in at ${it.label}! ${victim}'s stuff got hit. ${why}`, { tone: 'bad', focusId: it.id, toast: true })
  const near = neighbors(state, it)
  if (Math.random() < C.BURGLARY_VICTIM_LEAVES) moveOut(state, it, 'got robbed and moved out of')
  for (const n of near) if (Math.random() < C.BURGLARY_NEIGHBOR_LEAVES) moveOut(state, n, 'got spooked by the break-in and moved out of')
}

/** Burglars only show up from rebirth 5, and only while you're playing. */
export function stepBurglaries(state: GameState, dt: number, offline: boolean): void {
  if (offline || state.rebirth < C.BURGLARY_UNLOCK_REBIRTH) return
  state.burglaryIn -= dt
  if (state.burglaryIn > 0) return
  state.burglaryIn = expWait(C.BURGLARY_MEAN_SECONDS)
  burglary(state)
}

export const cameraSellValue = (c: Camera) => cameraDef(c.defId).cost * SELL_REFUND
export const fmtCameraPrice = (c: Camera) => money(cameraSellValue(c))
