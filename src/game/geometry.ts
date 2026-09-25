import type { Item, Rot } from './types'
import { UNITS } from '../data/units'
import { SIGNS } from '../data/signs'
import { GENERATORS } from '../data/power'

export interface Footprint { w: number; h: number }

export function baseSize(kind: Item['kind'], defId: string): Footprint {
  const def = kind === 'unit' ? UNITS.find(d => d.id === defId)
    : kind === 'sign' ? SIGNS.find(d => d.id === defId)
    : GENERATORS.find(d => d.id === defId)
  if (!def) throw new Error(`Unknown ${kind} ${defId}`)
  return { w: def.w, h: def.h }
}

/** Size after rotation: odd rotations swap width/height. */
export function rotatedSize(size: Footprint, rot: Rot): Footprint {
  return rot % 2 === 0 ? size : { w: size.h, h: size.w }
}

/** Door facing per rotation: 0 = down (toward the gate), 1 = left, 2 = up, 3 = right. */
export const DOOR_DIRS: Record<Rot, [number, number]> = { 0: [0, 1], 1: [-1, 0], 2: [0, -1], 3: [1, 0] }

/** The tile just outside a unit's door (the one that must be open & reachable). */
export function doorOutside(x: number, y: number, size: Footprint, rot: Rot): [number, number] {
  const { w, h } = rotatedSize(size, rot)
  const midX = x + Math.floor((w - 1) / 2)
  const midY = y + Math.floor((h - 1) / 2)
  switch (rot) {
    case 0: return [midX, y + h]
    case 1: return [x - 1, midY]
    case 2: return [midX, y - 1]
    case 3: return [x + w, midY]
  }
}

/** The tile inside the unit that the door sits on (for drawing). */
export function doorInside(x: number, y: number, size: Footprint, rot: Rot): [number, number] {
  const [ox, oy] = doorOutside(x, y, size, rot)
  const [dx, dy] = DOOR_DIRS[rot]
  return [ox - dx, oy - dy]
}

export function itemSize(item: Item): Footprint {
  return rotatedSize(baseSize(item.kind, item.defId), item.rot)
}

export function tilesOf(x: number, y: number, fp: Footprint): [number, number][] {
  const out: [number, number][] = []
  for (let j = 0; j < fp.h; j++) for (let i = 0; i < fp.w; i++) out.push([x + i, y + j])
  return out
}

/** The 3 locked tiles directly inside the gate (bottom-middle). */
export function lockedTiles(size: number): [number, number][] {
  const c = (size - 1) / 2
  return [[c - 1, size - 1], [c, size - 1], [c + 1, size - 1]]
}

export function isLocked(size: number, x: number, y: number): boolean {
  const c = (size - 1) / 2
  return y === size - 1 && x >= c - 1 && x <= c + 1
}
